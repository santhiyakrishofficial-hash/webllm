'use client';

import React, { useState } from 'react';
import { SubjectSelector } from '@/components/SubjectSelector';
import { ChatBox } from '@/components/ChatBox';
import { SUBJECTS } from '@/lib/prompts';

export default function Home() {
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0].id);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">KidsZone AI Tutor</h1>
        <p className="app-subtitle">Private, Offline, AI Learning Companion</p>
      </header>
      
      <main className="content-area">
        <SubjectSelector 
          activeSubject={activeSubject} 
          onSelect={setActiveSubject} 
        />
        
        <ChatBox subjectId={activeSubject} />
      </main>
    </div>
  );
}
