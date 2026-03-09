'use client';

import { parseJSON, distributeItemsByStudiepad } from '@/lib/utils';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Step1 from '@/components/Step1';
import Step2 from '@/components/Step2';
import { CurriculumData, StudentInfo, PlanGrid } from '@/lib/types';
import PrintModal from '@/components/PrintModal';
import PrintView from '@/components/PrintView';

export default function Home() {
  const [step, setStep] = useState<1 | 2>(1);
  const [opleidingUrl, setOpleidingUrl] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [selectedPad, setSelectedPad] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // S.student
  const [student, setStudent] = useState<StudentInfo>({
    name: '',
    number: '',
    coach: '',
    date: new Date().toISOString().split('T')[0],
  });

  // S.plan and S.achieved
  const [planGrid, setPlanGrid] = useState<PlanGrid>({});
  const [achieved, setAchieved] = useState<Set<string>>(new Set());

  // S.commentOpen
  const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set());

  // Modals
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    // Check local storage for resumed app state on mount
    const saved = localStorage.getItem('mijnStudiepad');
    if (saved) {
      try {
        const parsed = JSON.stringify(saved);
        // We will implement load logic here if needed or let user resume
      } catch (e) {
        // console.error(e)
      }
    }
  }, []);

  const loadCurriculum = async (url: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Kon JSON niet laden');
      const rawData = await res.json();

      const parsedModules = parseJSON(rawData);
      const data: CurriculumData = {
        studiepaden: rawData.studiepaden || {},
        modules: parsedModules
      };

      setCurriculum(data);
      setOpleidingUrl(url);

      const pads = Object.keys(data.studiepaden);
      if (pads.length > 0) {
        setSelectedPad(pads[0]);
        // Default grid using utility
        const initialGrid = distributeItemsByStudiepad(data.modules, data.studiepaden[pads[0]]);
        setPlanGrid(initialGrid);
      } else {
        setError('De opleiding heeft geen studiepaden ingevuld.');
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSave = () => {
    const data = {
      opleidingUrl,
      selectedPad,
      planGrid,
      achieved: Array.from(achieved),
      commentOpen: Array.from(commentOpen),
      student,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('mijnStudiepad', JSON.stringify(data));
    alert('Studieplan succesvol opgeslagen! (Lokaal in browser)');
  };

  return (
    <div className="min-h-screen bg-bg-app flex flex-col print:bg-white text-text-main">
      <Header
        step={step}
        onSave={handleSave}
        onPrint={() => setIsPrintModalOpen(true)}
      />
      <main className="flex-1 w-full max-w-[1140px] mx-auto px-6 py-7 print:hidden">
        {error && <div className="text-red-700 bg-red-50 border border-red-200 p-4 rounded-radius mb-6">{error}</div>}

        {step === 1 && (
          <Step1
            onSelectOpleiding={loadCurriculum}
            loading={loading}
          />
        )}

        {step === 2 && curriculum && (
          <Step2
            curriculum={curriculum}
            selectedPad={selectedPad}
            setSelectedPad={setSelectedPad}
            planGrid={planGrid}
            setPlanGrid={setPlanGrid}
            achieved={achieved}
            setAchieved={setAchieved}
            commentOpen={commentOpen}
            setCommentOpen={setCommentOpen}
          />
        )}
      </main>

      {isPrintModalOpen && step === 2 && (
        <PrintModal
          student={student}
          setStudent={setStudent}
          onClose={() => setIsPrintModalOpen(false)}
          onConfirm={() => {
            setIsPrintModalOpen(false);
            window.print();
          }}
        />
      )}

      <PrintView
        step={step}
        student={student}
        curriculum={curriculum}
        planGrid={planGrid}
        achieved={achieved}
      />
    </div>
  );
}
