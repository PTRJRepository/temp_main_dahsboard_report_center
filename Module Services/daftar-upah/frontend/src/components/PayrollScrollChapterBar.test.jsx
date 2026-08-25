import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PayrollScrollChapterBar from './PayrollScrollChapterBar';

describe('PayrollScrollChapterBar', () => {
    it('renders visible tab bar with group buttons and active highlight', () => {
        const html = renderToString(
            <PayrollScrollChapterBar
                isVisible
                activeGroup="PENGGAJIAN"
                allGroups={['IDENTITAS', 'PENGGAJIAN', 'UPAH BERSIH']}
                onSelectGroup={vi.fn()}
            />
        );

        expect(html).toContain('is-visible');
        expect(html).toContain('IDENTITAS');
        expect(html).toContain('PENGGAJIAN');
        expect(html).toContain('UPAH BERSIH');
        expect(html).toContain('is-active');
    });

    it('hides the dock when isVisible is false', () => {
        const html = renderToString(
            <PayrollScrollChapterBar
                isVisible={false}
                activeGroup="IDENTITAS"
                allGroups={['IDENTITAS']}
                onSelectGroup={vi.fn()}
            />
        );

        expect(html).toContain('is-hidden');
        expect(html).toContain('aria-hidden="true"');
    });
});
