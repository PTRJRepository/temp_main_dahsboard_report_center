import { duplicateNikMitigationService, NikResolutionResult } from "../../DuplicateNikMitigationService";

// ============================================================================
// NAME PARSING & NORMALIZATION
// ============================================================================

/**
 * Parse name to separate employee name from parent name
 * Format: "EMPLOYEE_NAME (PARENT_NAME)" or "EMPLOYEE_NAME ( PARENT_NAME )"
 * 
 * In Indonesian naming convention, text in parentheses is typically the parent's name
 */
export function parseEmployeeName(fullName: string): { employeeName: string; parentName?: string } {
    const trimmed = fullName.trim();
    const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)$/);
    
    if (parenMatch) {
        return {
            employeeName: parenMatch[1].trim(),
            parentName: parenMatch[2].trim()
        };
    }
    
    return {
        employeeName: trimmed,
        parentName: undefined
    };
}

/**
 * Normalize name for comparison (handle spacing and case variations)
 * IMPORTANT: Only normalizes the employee name part (excludes parent name in parentheses)
 */
export function normalizeName(name: string): string {
    const parsed = parseEmployeeName(name);
    return parsed.employeeName
        .toUpperCase()
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .replace(/[^A-Z0-9 ]/g, '') // Remove special characters
        .trim();
}

/**
 * Get the full employee name without parent name
 */
export function getEmployeeNameOnly(fullName: string): string {
    const parsed = parseEmployeeName(fullName);
    return parsed.employeeName;
}

/**
 * Get the parent name from full name (if present)
 */
export function getParentName(fullName: string): string | undefined {
    const parsed = parseEmployeeName(fullName);
    return parsed.parentName;
}

// ============================================================================
// NAME-BASED DUPLICATE ASSESSMENT
// ============================================================================

/**
 * Detect if duplicate NIK is likely a data entry error vs legitimate name change
 * 
 * Returns: 'likely_error' | 'likely_legitimate' | 'uncertain'
 * 
 * IMPORTANT: Names in parentheses () are parent names in Indonesian naming convention
 * Different employee names (outside parentheses) suggest different people
 */
export async function assessDuplicateLegitimacy(nik: string): Promise<{
    assessment: 'likely_error' | 'likely_legitimate' | 'uncertain';
    reasons: string[];
    recommendation: string;
}> {
    const employees = await duplicateNikMitigationService.getEmployeesByNik(nik);

    if (employees.length === 0) {
        return {
            assessment: 'uncertain',
            reasons: ['No employees found for this NIK'],
            recommendation: 'Manual review required'
        };
    }

    const reasons: string[] = [];
    let assessment: 'likely_error' | 'likely_legitimate' | 'uncertain' = 'uncertain';

    // Extract employee names (excluding parent names in parentheses)
    const employeeNamesWithParsing = employees.map(e => {
        const parsed = parseEmployeeName(e.emp_name);
        return {
            emp_code: e.emp_code,
            full_name: e.emp_name,
            employee_name: parsed.employeeName,
            parent_name: parsed.parentName,
            normalized: normalizeName(e.emp_name)
        };
    });

    // Check 1: All employees have same employee name (normalized, excluding parent name)
    const uniqueEmployeeNames = new Set(employeeNamesWithParsing.map(e => e.normalized));
    
    if (uniqueEmployeeNames.size === 1) {
        reasons.push('All employees have identical employee names (likely data duplication)');
        assessment = 'likely_error';
    } else if (uniqueEmployeeNames.size === 2) {
        // Two different employee names - could be name change or different people
        const names = Array.from(uniqueEmployeeNames);
        const similarity = calculateSimilarity(names[0], names[1]);
        
        if (similarity >= 70) {
            reasons.push(`Two similar employee names (${similarity.toFixed(0)}% similar) - possible name change or variation`);
            assessment = 'uncertain';
        } else {
            reasons.push('Two different employee names - may be different people sharing NIK');
            assessment = 'likely_legitimate';
        }
    } else if (uniqueEmployeeNames.size > 2) {
        reasons.push(`${uniqueEmployeeNames.size} different employee names associated with same NIK (likely error or multiple people)`);
        
        // Check if they are all similar (variations) or truly different
        const namesArray = Array.from(uniqueEmployeeNames);
        let allSimilar = true;
        for (let i = 1; i < namesArray.length; i++) {
            const sim = calculateSimilarity(namesArray[0], namesArray[i]);
            if (sim < 60) {
                allSimilar = false;
                break;
            }
        }
        
        if (allSimilar) {
            reasons.push('Names are variations of each other (likely data entry inconsistencies)');
            assessment = 'likely_error';
        } else {
            reasons.push('Names are significantly different - likely different people or serious data error');
            assessment = 'likely_legitimate';
        }
    }

    // Check 2: Multiple active employees
    const activeCount = employees.filter(e => e.status === '1').length;
    if (activeCount > 1) {
        reasons.push(`${activeCount} active employees found (should be only 1)`);
        if (uniqueEmployeeNames.size > 1) {
            reasons.push('Multiple active employees with different names - likely different people');
            assessment = 'likely_legitimate';
        } else {
            assessment = 'likely_error';
        }
    }

    // Check 3: Same gang assignment
    const gangCodes = new Set(employees.filter(e => e.gang_code).map(e => e.gang_code));
    if (gangCodes.size === 1 && employees.length > 1) {
        reasons.push('All employees assigned to same gang (duplicate entry)');
        if (uniqueEmployeeNames.size > 1) {
            reasons.push('But different employee names - data inconsistency');
            assessment = 'likely_legitimate';
        } else {
            assessment = 'likely_error';
        }
    }

    // Check 4: Sequential EmpCodes (indicates batch entry error)
    const empCodes = employees.map(e => e.emp_code).sort();
    if (empCodes.length >= 2) {
        const isSequential = empCodes.every((code, i) => {
            if (i === 0) return true;
            const prevNum = parseInt(code.slice(1));
            const currNum = parseInt(empCodes[i - 1].slice(1));
            return !isNaN(prevNum) && !isNaN(currNum) && (prevNum - currNum <= 10);
        });

        if (isSequential) {
            reasons.push('Sequential EmpCodes (likely batch entry error)');
            if (uniqueEmployeeNames.size > 1) {
                reasons.push('Different names with sequential codes - possible family members or data error');
                // Don't change assessment, keep it uncertain
            } else {
                assessment = 'likely_error';
            }
        }
    }

    // Check 5: Large time gap between join dates
    const joinDates = employees
        .filter(e => e.join_date)
        .map(e => new Date(e.join_date!).getTime());

    if (joinDates.length >= 2) {
        const maxGap = Math.max(...joinDates) - Math.min(...joinDates);
        const yearsGap = maxGap / (1000 * 60 * 60 * 24 * 365);

        if (yearsGap > 1) {
            reasons.push(`Large time gap (${yearsGap.toFixed(1)} years) between join dates`);
            
            if (uniqueEmployeeNames.size > 1) {
                reasons.push('Different names + large time gap = likely different people (legitimate)');
                assessment = 'likely_legitimate';
            } else {
                reasons.push('Possible legitimate name change');
                if (assessment !== 'likely_error') {
                    assessment = 'likely_legitimate';
                }
            }
        }
    }

    // Check 6: Parent name analysis (if available)
    const parentNames = employeeNamesWithParsing
        .filter(e => e.parent_name)
        .map(e => e.parent_name!.toUpperCase());
    
    if (parentNames.length > 0) {
        const uniqueParentNames = new Set(parentNames);
        
        if (uniqueEmployeeNames.size > 1 && uniqueParentNames.size === 1) {
            reasons.push('Different employee names but same parent name - possible family members');
            assessment = 'likely_legitimate';
        } else if (uniqueEmployeeNames.size > 1 && uniqueParentNames.size > 1) {
            reasons.push('Different employee names and different parent names - likely different people');
            assessment = 'likely_legitimate';
        }
    }

    let recommendation = '';
    if (assessment === 'likely_error') {
        recommendation = 'Recommend merging duplicate records and keeping only the active employee';
    } else if (assessment === 'likely_legitimate') {
        if (uniqueEmployeeNames.size > 1) {
            recommendation = 'Different employee names detected - verify if these are different people sharing the same NIK (family members) or data entry error. Check physical employee records.';
        } else {
            recommendation = 'May be legitimate - verify with HR department for name change documentation';
        }
    } else {
        recommendation = 'Manual review required - insufficient data to determine legitimacy. Check employee physical files.';
    }

    return { assessment, reasons, recommendation };
}

// ============================================================================
// FUZZY MATCHING (Levenshtein Distance)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to change one word into the other
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    // Create a matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize first column and first row
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // deletion
                dp[i][j - 1] + 1,      // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
            
            // Consider transposition (Damerau-Levenshtein)
            if (i > 1 && j > 1 && 
                str1[i - 1] === str2[j - 2] && 
                str1[i - 2] === str2[j - 1]) {
                dp[i][j] = Math.min(
                    dp[i][j],
                    dp[i - 2][j - 2] + cost // transposition
                );
            }
        }
    }
    
    return dp[m][n];
}

/**
 * Calculate similarity percentage between two strings
 * Returns 0-100 where 100 is exact match
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;
    
    const distance = levenshteinDistance(str1, str2);
    return ((maxLen - distance) / maxLen) * 100;
}

/**
 * Find employees by fuzzy name matching
 * Useful when NIK is unreliable and exact name match fails
 */
export async function findEmployeesByFuzzyName(
    name: string,
    options?: {
        gang?: string;
        division?: string;
        limit?: number;
        minSimilarity?: number; // Default 70%
    }
): Promise<Array<{
    emp_code: string;
    emp_name: string;
    gang_code: string;
    division_code: string;
    status: string;
    similarity: number;
    join_date?: string;
    terminate_date?: string;
}>> {
    // First get all employees with similar names using LIKE
    const allMatches = await duplicateNikMitigationService.findEmployeesByName(name, {
        gang: options?.gang,
        division: options?.division,
        limit: options?.limit ? options.limit * 2 : 20 // Get more candidates for filtering
    });

    const minSimilarity = options?.minSimilarity || 70;
    const searchName = normalizeName(name);

    // Calculate fuzzy similarity for each match
    const scoredMatches = allMatches.map(emp => ({
        ...emp,
        similarity: calculateSimilarity(searchName, normalizeName(emp.emp_name))
    }));

    // Filter by minimum similarity and sort by similarity descending
    const filteredMatches = scoredMatches
        .filter(emp => emp.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, options?.limit || 10);

    return filteredMatches;
}

/**
 * Resolve employee using fuzzy name matching when NIK and exact name fail
 */
export async function resolveByFuzzyName(
    nik: string,
    approximateName: string,
    options?: {
        gang?: string;
        division?: string;
        minSimilarity?: number;
    }
): Promise<NikResolutionResult> {
    // Try exact NIK first
    const nikResult = await duplicateNikMitigationService.resolveEmpCode(nik, {
        preferredGang: options?.gang,
        preferredDivision: options?.division
    });

    if (nikResult.resolved_emp_code && nikResult.confidence !== 'low') {
        return nikResult;
    }

    // Fallback to fuzzy name matching
    const fuzzyMatches = await findEmployeesByFuzzyName(approximateName, {
        gang: options?.gang,
        division: options?.division,
        minSimilarity: options?.minSimilarity || 75
    });

    if (fuzzyMatches.length === 1) {
        return {
            nik,
            resolved_emp_code: fuzzyMatches[0].emp_code,
            resolution_method: 'name_match',
            all_emp_codes: [fuzzyMatches[0].emp_code],
            confidence: 'medium',
            notes: `Resolved by fuzzy name match (${fuzzyMatches[0].similarity.toFixed(1)}% similarity)`
        };
    }

    if (fuzzyMatches.length > 1) {
        // Use the highest similarity match
        const bestMatch = fuzzyMatches[0];
        
        return {
            nik,
            resolved_emp_code: bestMatch.emp_code,
            resolution_method: 'name_match',
            all_emp_codes: fuzzyMatches.map(m => m.emp_code),
            confidence: bestMatch.similarity >= 90 ? 'high' : 'medium',
            notes: `Resolved by best fuzzy name match (${bestMatch.similarity.toFixed(1)}% similarity)`
        };
    }

    return {
        nik,
        resolved_emp_code: null,
        resolution_method: 'single',
        all_emp_codes: [],
        confidence: 'low',
        notes: 'Could not resolve using NIK or fuzzy name matching'
    };
}
