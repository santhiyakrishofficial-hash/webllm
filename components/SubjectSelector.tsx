import React from 'react';
import { SUBJECTS } from '@/lib/prompts';

interface SubjectSelectorProps {
  activeSubject: string;
  onSelect: (subjectId: string) => void;
}

export function SubjectSelector({ activeSubject, onSelect }: SubjectSelectorProps) {
  return (
    <div className="subject-selector">
      {SUBJECTS.map((subject) => (
        <button
          key={subject.id}
          className={`subject-btn ${activeSubject === subject.id ? 'active' : ''}`}
          onClick={() => onSelect(subject.id)}
        >
          {subject.name}
        </button>
      ))}
    </div>
  );
}
