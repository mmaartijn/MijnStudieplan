export interface Toetsonderdeel {
    titel: string;
}

export interface Outcome {
    name: string;
    studiepunten: number;
    qualification: string;
    description: string;
    toetsonderdelen?: Toetsonderdeel[];
    titel?: string;
    omschrijving?: string;
}

export type ToetsonderdeelState = 'checked' | 'unchecked' | 'vervallen';

export interface Module {
    code: string;
    naam: string;
    periodes: number[];
    leeruitkomsten: Outcome[];
    // Transformed for internal use
    outcomes?: Outcome[];
}

export interface CurriculumData {
    studiepaden: Record<string, string[]>;
    modules: Module[];
}

export interface StudentInfo {
    name: string;
    number: string;
    coach: string;
    date: string;
}

export interface PlanItem {
    code: string;
    idx: number; // Index of the outcome in module
}

export interface PlanCell {
    items: PlanItem[];
    comment?: string;
}

// Map: "year_period" -> PlanCell
export type PlanGrid = Record<string, PlanCell>;

