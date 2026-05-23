'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import id from '../dictionaries/id.json';
import en from '../dictionaries/en.json';

type Language = 'id' | 'en';
type Dictionary = typeof id;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Dictionary;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('id');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Check local storage for saved language preference on mount
        const savedLang = localStorage.getItem('language') as Language;
        if (savedLang && (savedLang === 'id' || savedLang === 'en')) {
            setLanguageState(savedLang);
        }
        setMounted(true);
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = language === 'id' ? id : en;

    // Prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        // If not in provider, return fallback (Indonesian)
        return {
            language: 'id' as Language,
            setLanguage: () => { },
            t: id,
        };
    }
    return context;
}
