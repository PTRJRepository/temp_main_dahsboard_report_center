import React from 'react';

const MODE_OPTIONS = [
    { id: 'simple', label: 'Fokus' },
    { id: 'detail', label: 'Semua' }
];

const SOURCE_MODE_OPTIONS = [
    {
        id: 'non_db_ptrj',
        label: 'Non DB_PTRJ',
        state: 'Auto Buffer + Manual Adj',
        title: 'Tunjangan auto-buffer dan premi/koreksi/potongan dari manual adjustment. Lembur tetap dari db_ptrj dan dihitung lewat lembur calculator.'
    },
    {
        id: 'db_ptrj_only',
        label: 'DB_PTRJ Only',
        state: 'Nilai asli PTRJ',
        title: 'Tampilkan nilai asli dari db_ptrj pada kolom yang sama.'
    }
];

const normalizeSourceMode = (value) => (
    String(value || '').trim().toLowerCase() === 'db_ptrj_only'
        ? 'db_ptrj_only'
        : 'non_db_ptrj'
);

export default function PayrollViewModeToolbar({
    mode = 'simple',
    focusLens = false,
    taxExpanded = false,
    valuePriorityMode = 'non_db_ptrj',
    isSeedingAutoBuffer = false,
    tableTheme = 'skeuo',
    onModeChange = () => {},
    onFocusLensChange = () => {},
    onToggleTax = () => {},
    onValuePriorityModeChange = () => {},
    onSeedAutoBuffer = () => {},
    onTableThemeChange = () => {}
}) {
    const sourceMode = normalizeSourceMode(valuePriorityMode);
    const themeMode = String(tableTheme || '').toLowerCase() === 'classic' ? 'classic' : 'skeuo';

    return (
        <div className="payroll-view-toolbar" role="toolbar" aria-label="Pengaturan tampilan tabel payroll">
            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Gaya</span>
                <div className="payroll-view-toolbar__group" role="group" aria-label="Gaya tampilan tabel">
                    <button
                        type="button"
                        className={`payroll-view-toolbar__button payroll-view-toolbar__button--theme-skeuo ${themeMode === 'skeuo' ? 'is-active' : ''}`}
                        aria-pressed={themeMode === 'skeuo'}
                        title="Estate Ledger — tampilan material kulit, kuningan, dan kertas"
                        onClick={() => onTableThemeChange('skeuo')}
                    >
                        <span className="payroll-view-toolbar__button-copy">Skeuomorfik</span>
                        <span className="payroll-view-toolbar__button-state">Ledger</span>
                    </button>
                    <button
                        type="button"
                        className={`payroll-view-toolbar__button payroll-view-toolbar__button--theme-classic ${themeMode === 'classic' ? 'is-active' : ''}`}
                        aria-pressed={themeMode === 'classic'}
                        title="Tampilan klasik datar (terang, tanpa tekstur)"
                        onClick={() => onTableThemeChange('classic')}
                    >
                        <span className="payroll-view-toolbar__button-copy">Klasik</span>
                        <span className="payroll-view-toolbar__button-state">Datar</span>
                    </button>
                </div>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Tampilan</span>
                <div className="payroll-view-toolbar__group" role="group" aria-label="Mode tabel">
                    {MODE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`payroll-view-toolbar__button payroll-view-toolbar__button--${option.id} ${mode === option.id ? 'is-active' : ''}`}
                            aria-pressed={mode === option.id}
                            onClick={() => onModeChange(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="payroll-view-toolbar__section">
                <label className={`payroll-view-toolbar__toggle ${focusLens ? 'is-active' : ''}`}>
                    <input
                        type="checkbox"
                        className="payroll-view-toolbar__toggle-input"
                        checked={focusLens}
                        onChange={(event) => onFocusLensChange(event.target.checked)}
                    />
                    <span className="payroll-view-toolbar__toggle-indicator" aria-hidden="true" />
                    <span className="payroll-view-toolbar__toggle-copy">
                        <span className="payroll-view-toolbar__toggle-title">Fokus Grup</span>
                        <span className="payroll-view-toolbar__toggle-subtitle">Opsional, sorot grup aktif</span>
                    </span>
                </label>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Sumber Nilai</span>
                <div className="payroll-view-toolbar__group" role="group" aria-label="Sumber nilai payroll">
                    {SOURCE_MODE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`payroll-view-toolbar__button payroll-view-toolbar__button--source payroll-view-toolbar__button--source-${option.id} ${sourceMode === option.id ? 'is-active' : ''}`}
                            aria-pressed={sourceMode === option.id}
                            title={option.title}
                            onClick={() => onValuePriorityModeChange(option.id)}
                        >
                            <span className="payroll-view-toolbar__button-copy">{option.label}</span>
                            <span className="payroll-view-toolbar__button-state">{option.state}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Detail Pajak</span>
                <button
                    type="button"
                    className={`payroll-view-toolbar__button payroll-view-toolbar__button--tax ${taxExpanded ? 'is-active' : ''}`}
                    aria-pressed={taxExpanded}
                    onClick={onToggleTax}
                >
                    <span className="payroll-view-toolbar__button-copy">Pajak</span>
                    <span className="payroll-view-toolbar__button-state">{taxExpanded ? 'Terbuka' : 'Ringkas'}</span>
                </button>
            </div>

            <div className="payroll-view-toolbar__section">
                <span className="payroll-view-toolbar__label">Seeder</span>
                <button
                    type="button"
                    className={`payroll-view-toolbar__button payroll-view-toolbar__button--seed ${isSeedingAutoBuffer ? 'is-active' : ''}`}
                    onClick={onSeedAutoBuffer}
                    disabled={isSeedingAutoBuffer}
                >
                    {isSeedingAutoBuffer ? 'Menyimpan Buffer...' : 'Seed Buffer -> Manual'}
                </button>
            </div>
        </div>
    );
}
