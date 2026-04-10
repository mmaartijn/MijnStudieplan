import { StudentInfo } from '@/lib/types';

interface PrintModalProps {
    student: StudentInfo;
    setStudent: (student: StudentInfo) => void;
    onClose: () => void;
    onConfirm: () => void;
}

export default function PrintModal({ student, setStudent, onClose, onConfirm }: PrintModalProps) {
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4 print:hidden">
            <div
                className="bg-card rounded-radius shadow-xl w-full max-w-[540px] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()} // Stop click through
            >
                <div className="p-6">
                    <h3 className="text-xl font-bold mb-1.5 text-text-main">Studentgegevens</h3>
                    <p className="text-sm text-muted mb-4">Vul je gegevens in zodat ze op het PDF/geprinte studieplan verschijnen.</p>

                    <div className="bg-card border border-border-subtle rounded-radius p-4 mb-5 flex flex-col gap-3">
                        <div className="flex gap-3.5 flex-wrap">
                            <label className="flex-1 min-w-[190px] text-[0.82rem] text-muted flex flex-col gap-1">
                                Naam student
                                <input
                                    type="text"
                                    value={student.name}
                                    onChange={e => setStudent({ ...student, name: e.target.value })}
                                    className="border border-border-subtle rounded px-2.5 py-1.5 text-[0.9rem] text-text-main outline-none focus:border-primary"
                                    placeholder="Volledige naam"
                                />
                            </label>
                            <label className="flex-1 min-w-[190px] text-[0.82rem] text-muted flex flex-col gap-1">
                                Studentnummer
                                <input
                                    type="text"
                                    value={student.number}
                                    onChange={e => setStudent({ ...student, number: e.target.value })}
                                    className="border border-border-subtle rounded px-2.5 py-1.5 text-[0.9rem] text-text-main outline-none focus:border-primary"
                                    placeholder="12345678"
                                />
                            </label>
                        </div>

                        <div className="flex gap-3.5 flex-wrap">
                            <label className="flex-1 min-w-[190px] text-[0.82rem] text-muted flex flex-col gap-1">
                                Studiecoach
                                <input
                                    type="text"
                                    value={student.coach}
                                    onChange={e => setStudent({ ...student, coach: e.target.value })}
                                    className="border border-border-subtle rounded px-2.5 py-1.5 text-[0.9rem] text-text-main outline-none focus:border-primary"
                                    placeholder="Naam coach"
                                />
                            </label>
                            <label className="flex-1 min-w-[190px] text-[0.82rem] text-muted flex flex-col gap-1">
                                Datum
                                <input
                                    type="date"
                                    value={student.date}
                                    onChange={e => setStudent({ ...student, date: e.target.value })}
                                    className="border border-border-subtle rounded px-2.5 py-1.5 text-[0.9rem] text-text-main outline-none focus:border-primary"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-[0.9rem] font-medium border border-border-subtle rounded bg-card text-text-main hover:bg-bg-app transition-colors"
                        >
                            Annuleren
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-5 py-2 text-[0.9rem] font-medium border-none rounded bg-success text-white hover:bg-success-dark transition-colors cursor-pointer"
                        >
                            Bevestig & Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Backdrop closer */}
            <div className="absolute inset-0 -z-10" onClick={onClose}></div>
        </div>
    );
}
