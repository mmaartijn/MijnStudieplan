export function parseJSON(data: any) {
    return (data.modules || []).map((mod: any) => {
        const code = mod.code || '';
        const m = code.match(/^(\d+)/);
        const jaar = m ? parseInt(m[1]) : 0;
        const name = mod.naam || code;

        // Converteer flat periodes [1,2] -> [[1,2]]
        const periodes = mod.periodes?.length ? [mod.periodes] : [];
        const outcomes = (mod.leeruitkomsten || []).map((lu: any) => {
            const qm = (lu.omschrijving || '').match(/eindkwalificaties?\s+(.+?)\.?\s*$/m);
            return {
                name: lu.titel || '',
                studiepunten: lu.studiepunten || 0,
                qualification: qm ? qm[1].replace(/\s+en\s+/g, ', ').trim() : '',
                description: lu.omschrijving || '',
                toetsonderdelen: lu.toetsonderdelen || []
            };
        });
        return { code, name, naam: name, jaar, periodes, outcomes };
    }).filter((m: any) => m.code);
}

export function distributeItemsByStudiepad(modules: any[], padArray: string[]) {
    const grid: Record<string, { items: any[], comment: string }> = {};

    // init grid
    for (let y = 1; y <= 4; y++) {
        for (let p = 1; p <= 4; p++) {
            grid[`${y}_${p}`] = { items: [], comment: '' };
        }
    }

    if (!padArray || padArray.length === 0) {
        // default dist handled elsewhere or return empty
        return grid;
    }

    modules.forEach(mod => {
        const modKeys: string[] = [];
        padArray.forEach((padStr, idx) => {
            const codes = padStr.split(',').map(s => s.trim());
            if (codes.includes(mod.code)) {
                const y = Math.floor(idx / 4) + 1;
                const p = (idx % 4) + 1;
                modKeys.push(`${y}_${p}`);
            }
        });

        if (modKeys.length === 0) {
            // Not in pad, add to 1_1 or unplanned ideally? 
            // Original script had defaultDist logic
            return;
        }

        // Round-robin assignment of outcomes based on their order and the assigned periods
        mod.outcomes.forEach((_: any, i: number) => {
            const key = modKeys[i % modKeys.length];
            if (grid[key]) grid[key].items.push({ code: mod.code, idx: i });
        });
    });

    return grid;
}
