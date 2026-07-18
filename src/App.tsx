/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent } from 'react';
import { Settings, Play, Upload, ChevronDown, ChevronUp, Plus, Download } from 'lucide-react';

export default function App() {
  const [selectedOption, setSelectedOption] = useState<'pdf' | 'photo' | 'file-to-question' | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'conversion'>('home');
  const [file, setFile] = useState<File | null>(null);
  const [conversionTasks, setConversionTasks] = useState<{file: string, result: string}[]>([]);
  const [result, setResult] = useState<string>('');
  const [allInstructionBoxes, setAllInstructionBoxes] = useState<Record<'pdf' | 'photo' | 'file-to-question', {id: number, isOpen: boolean, example: string, json: string, saved: boolean, fileExample?: File | null, fileJson?: File | null}[]>>({
      pdf: [],
      photo: [],
      'file-to-question': []
  });
  const [allGeneralInstructions, setAllGeneralInstructions] = useState<Record<'pdf' | 'photo' | 'file-to-question', {text: string, saved: boolean}>>({
      pdf: {text: '', saved: false},
      photo: {text: '', saved: false},
      'file-to-question': {text: '', saved: false}
  });
  const [deletingBoxId, setDeletingBoxId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{boxId: number, field: 'example' | 'json'} | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultWindowRef = useRef<HTMLDivElement>(null);

  const currentInstructionBoxes = selectedOption ? allInstructionBoxes[selectedOption] : [];

  const updateCurrentInstructionBoxes = (newBoxes: typeof currentInstructionBoxes) => {
    if (selectedOption) {
        setAllInstructionBoxes(prev => ({ ...prev, [selectedOption]: newBoxes }));
    }
  };

  const startPress = (id: number) => {
    pressTimer.current = setTimeout(() => {
      setDeletingBoxId(id);
    }, 500);
  };

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const toggleBox = (id: number) => {
    updateCurrentInstructionBoxes(currentInstructionBoxes.map(box => box.id === id ? {...box, isOpen: !box.isOpen} : box));
  };

  const updateBoxField = (id: number, field: 'example' | 'json', value: string) => {
    updateCurrentInstructionBoxes(currentInstructionBoxes.map(box => box.id === id ? {...box, [field]: value} : box));
  };

  const updateBoxFile = (id: number, field: 'example' | 'json', file: File | null) => {
    updateCurrentInstructionBoxes(currentInstructionBoxes.map(box => box.id === id ? {...box, [field === 'example' ? 'fileExample' : 'fileJson']: file} : box));
  };

  const saveBox = async (id: number) => {
    const box = currentInstructionBoxes.find(b => b.id === id);
    if (!box || !selectedOption) return;
    try {
        const formData = new FormData();
        formData.append('id', id.toString());
        formData.append('example', box.example);
        formData.append('json', box.json);
        formData.append('option', selectedOption);
        if (box.fileExample) formData.append('fileExample', box.fileExample);
        if (box.fileJson) formData.append('fileJson', box.fileJson);

        await fetch('/api/save-instructions', {
            method: 'POST',
            body: formData
        });
        updateCurrentInstructionBoxes(currentInstructionBoxes.map(b => b.id === id ? {...b, saved: true} : b));
    } catch(e) {
        console.error(e);
        alert("Failed to save");
    }
  };

  const handleStart = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
    
    setIsLoading(true);
    setResult('');
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("instructions", selectedOption === 'file-to-question' ? "Convert to Question" : "Convert");
    if (selectedOption) formData.append("option", selectedOption);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      if (!response.body) throw new Error("No response body");
            
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let finalResult = '';
      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          finalResult += chunk;
          setResult(finalResult);
      }
      
      const task = {file: file.name, result: finalResult};
      setConversionTasks([...conversionTasks, task]);
      // setFile(null); // Keep file? User didn't say to remove it.
      resultWindowRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (uploadTarget) {
          updateBoxField(uploadTarget.boxId, uploadTarget.field, `[File: ${file.name}]`);
          updateBoxFile(uploadTarget.boxId, uploadTarget.field, file);
          setUploadTarget(null);
      } else {
          setFile(file);
      }
    }
  };

  const renderHomeView = () => (
    <div className="w-full max-w-3xl">
        {/* Header Section */}
        <header className="flex justify-between items-center mb-12">
          <div className="space-y-1 w-full">
            <h1 className="text-4xl font-bold tracking-tight text-white">Welcome Back</h1>
            <p className="text-slate-400 text-sm">Ready to structure your documents?</p>
            <div className="text-xl font-semibold text-white mt-4 border-b border-slate-700 pb-2">
              {selectedOption === 'pdf' ? 'PDF TO JSON' : selectedOption === 'photo' ? 'PHOTO TO JSON' : selectedOption === 'file-to-question' ? 'FILE TO QUESTION' : 'ADD INSTRUCTIONS'}
            </div>
          </div>
          <button className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl hover:bg-slate-800 transition-colors">
            <Settings size={24} className="text-slate-300" />
          </button>
        </header>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-6 mb-10">
          <div className="flex gap-6 justify-center">
            <button
              onClick={() => { setSelectedOption('pdf'); setCurrentView('conversion'); }}
              className="group relative"
            >
              <div className={`absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full blur ${selectedOption === 'pdf' ? 'opacity-75' : 'opacity-25'} transition duration-1000`}></div>
              <div className="relative flex items-center gap-3 px-10 py-5 bg-slate-900 rounded-full border border-slate-800">
                <span className="font-semibold text-lg text-blue-400 uppercase tracking-widest">PDF</span>
                <span className="font-bold text-lg text-white uppercase tracking-tighter">JSON</span>
              </div>
            </button>
            <button
              onClick={() => { setSelectedOption('photo'); setCurrentView('conversion'); }}
              className="group relative"
            >
              <div className={`absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full blur ${selectedOption === 'photo' ? 'opacity-75' : 'opacity-25'} transition duration-1000`}></div>
              <div className="relative flex items-center gap-3 px-10 py-5 bg-slate-900 rounded-full border border-slate-800">
                <span className="font-semibold text-lg text-purple-400 uppercase tracking-widest">PHOTO</span>
                <span className="font-bold text-lg text-white uppercase tracking-tighter">JSON</span>
              </div>
            </button>
          </div>
          <button
            onClick={() => { setSelectedOption('file-to-question'); setCurrentView('conversion'); }}
            className="group relative"
          >
            <div className={`absolute -inset-1 bg-gradient-to-r from-emerald-600 to-green-500 rounded-full blur ${selectedOption === 'file-to-question' ? 'opacity-75' : 'opacity-25'} transition duration-1000`}></div>
            <div className="relative flex items-center gap-3 px-10 py-5 bg-slate-900 rounded-full border border-slate-800">
              <span className="font-semibold text-lg text-emerald-400 uppercase tracking-widest">FILE</span>
              <span className="font-bold text-lg text-white uppercase tracking-tighter">QUESTION</span>
            </div>
          </button>
        </div>

        {/* Conversion List */}
        <div className="mb-10 space-y-4">
            {conversionTasks.map((task, index) => (
                <div key={index} className="flex bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-sm">
                    <div className="flex-1 text-blue-300 border-r border-slate-700 pr-4">File: {task.file}</div>
                    <div className="flex-1 text-emerald-300 pl-4">JSON: {task.result.substring(0, 20)}...</div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderConversionView = () => (
    <div className="w-full max-w-3xl">
      <header className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-white">{selectedOption === 'pdf' ? 'PDF TO JSON' : selectedOption === 'photo' ? 'PHOTO TO JSON' : selectedOption === 'file-to-question' ? 'FILE TO QUESTION' : 'CONVERTING'}</h1>
        <button onClick={() => setCurrentView('home')} className="text-slate-400 hover:text-white">Back</button>
      </header>
      
      <button 
        onClick={() => updateCurrentInstructionBoxes([...currentInstructionBoxes, {id: Date.now(), isOpen: true, example: '', json: '', saved: false}])}
        className="mb-8 w-full py-3 bg-slate-800 rounded-lg text-slate-200 font-semibold hover:bg-slate-700 transition"
      >
        Add Instructions
      </button>

      <div className="space-y-4 mb-10">
        {currentInstructionBoxes.map(box => {
          const isSaveEnabled = (box.example.trim() !== '' || box.fileExample) && (box.json.trim() !== '' || box.fileJson);
          return (
          <div key={box.id} className="flex flex-col gap-1">
            <div className="border border-slate-700 rounded-lg overflow-hidden"
                 onMouseDown={() => startPress(box.id)}
                 onMouseUp={endPress}
                 onMouseLeave={endPress}
                 onTouchStart={() => startPress(box.id)}
                 onTouchEnd={endPress}>
              <button onClick={() => toggleBox(box.id)} className="w-full flex items-center justify-between p-4 bg-slate-900 text-white font-semibold">
                Instruction {box.id}
                {box.isOpen ? <ChevronUp /> : <ChevronDown />}
              </button>
              {box.isOpen && (
                <div className="flex flex-col border-t border-slate-700">
                  <div className="flex border-b border-slate-700">
                    <div className="w-1/2 p-4 border-r border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-400 mb-2 flex justify-between">Example {box.fileExample && <span className="text-emerald-400 text-xs truncate max-w-[100px]">{box.fileExample.name}</span>} <button onClick={() => { setUploadTarget({boxId: box.id, field: 'example'}); fileInputRef.current?.click(); }}><Plus size={16}/></button></h3>
                      <textarea value={box.example} onChange={(e) => updateBoxField(box.id, 'example', e.target.value)} className="w-full h-20 bg-slate-950 rounded p-2 text-white" />
                    </div>
                    <div className="w-1/2 p-4">
                      <h3 className="text-sm font-semibold text-slate-400 mb-2 flex justify-between">JSON Format {box.fileJson && <span className="text-emerald-400 text-xs truncate max-w-[100px]">{box.fileJson.name}</span>} <button onClick={() => { setUploadTarget({boxId: box.id, field: 'json'}); fileInputRef.current?.click(); }}><Plus size={16}/></button></h3>
                      <textarea value={box.json} onChange={(e) => updateBoxField(box.id, 'json', e.target.value)} className="w-full h-20 bg-slate-950 rounded p-2 text-white" />
                    </div>
                  </div>
                  <button 
                    disabled={!isSaveEnabled || box.saved}
                    onClick={() => saveBox(box.id)}
                    className={`w-full py-3 font-semibold transition ${isSaveEnabled && !box.saved ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                      {box.saved ? 'Saved' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center">Long press to remove</p>
          </div>
        )})}
      </div>
      
      {/* General Instruction Box */}
      {selectedOption && (
        <>
            <div className="flex gap-2 items-center bg-slate-900 p-2 rounded-lg border border-slate-700">
                <textarea 
                    value={allGeneralInstructions[selectedOption].text}
                    onChange={(e) => setAllGeneralInstructions(prev => ({...prev, [selectedOption]: {...prev[selectedOption], text: e.target.value}}))}
                    placeholder="Add instructions as you want..."
                    className="flex-1 bg-transparent p-2 text-white outline-none"
                />
                <button 
                    disabled={!allGeneralInstructions[selectedOption].text.trim() || allGeneralInstructions[selectedOption].saved}
                    onClick={async () => {
                        if (!selectedOption) return;
                        await fetch('/api/save-general-instructions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: allGeneralInstructions[selectedOption].text, option: selectedOption })
                        });
                        setAllGeneralInstructions(prev => ({...prev, [selectedOption]: {...prev[selectedOption], saved: true}}));
                    }}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${allGeneralInstructions[selectedOption].text.trim() && !allGeneralInstructions[selectedOption].saved ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                >
                    {allGeneralInstructions[selectedOption].saved ? 'Saved' : 'Save'}
                </button>
            </div>
            <button 
                type="button"
                onClick={() => {
                    const isContentFilled = (
                        currentInstructionBoxes.some(box => box.example.trim() !== '' || box.json.trim() !== '') ||
                        allGeneralInstructions[selectedOption!].text.trim() !== ''
                    );
                    if (!isContentFilled) {
                        alert("Fill this...");
                    } else {
                        fileInputRef.current?.click();
                    }
                }}
                className={`mt-2 flex items-center justify-center w-full py-2 rounded-lg transition ${
                    (currentInstructionBoxes.some(box => box.example.trim() !== '' || box.json.trim() !== '') ||
                    allGeneralInstructions[selectedOption!].text.trim() !== '')
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                }`}
            >
                <Plus size={24} />
                {file && <span className="ml-2 text-xs truncate">{file.name}</span>}
            </button>
        </>
      )}
      
      {/* Start Trigger */}
      <div className="mt-20 mb-10 flex justify-center">
        <button
          onClick={handleStart}
          className="flex flex-col items-center gap-2 group"
        >
          <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)] border-4 border-indigo-500 group-hover:scale-110 group-active:scale-95 transition-all">
            <Play size={40} className="text-white fill-white" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 pt-2">
              {file ? `Start (${file.name})` : 'Initiate Process'}
          </span>
        </button>
      </div>

      {/* Output Canvas */}
      <div ref={resultWindowRef} className="w-full h-80 relative">
        <div className="absolute inset-0 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                <span className="ml-4 text-xs font-mono text-slate-500 tracking-wider uppercase">Converted Output Window</span>
              </div>
              <button onClick={() => {
                  const blob = new Blob([result], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'converted-result.txt';
                  a.click();
                  URL.revokeObjectURL(url);
              }} className="text-slate-500 hover:text-white transition">
                  <Download size={18} />
              </button>
          </div>
          <div className="flex-1 p-8 font-mono text-sm overflow-auto text-slate-400">
              <pre>{result || '// Awaiting conversion start...'}</pre>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 flex flex-col items-center font-sans">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
        {currentView === 'home' ? renderHomeView() : renderConversionView()}
        {isLoading && (
            <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50">
                <div className="text-white text-xl font-bold animate-pulse">Processing...</div>
            </div>
        )}
        {deletingBoxId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setDeletingBoxId(null)}>
          <div className="bg-slate-800 p-6 rounded-lg text-white" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Are you sure you want to delete this instruction box?</h2>
            <div className="flex gap-4">
              <button onClick={() => { updateCurrentInstructionBoxes(currentInstructionBoxes.filter(b => b.id !== deletingBoxId)); setDeletingBoxId(null); }} className="bg-red-600 px-4 py-2 rounded">Yes</button>
              <button onClick={() => setDeletingBoxId(null)} className="bg-slate-600 px-4 py-2 rounded">No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );}
