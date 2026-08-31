import React from 'react';
import ReactMarkdown from 'react-markdown';

export interface MessageType {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional base64 image attached to a user message */
  imageDataUrl?: string;
}

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const getMessageClass = () => {
    switch (message.role) {
      case 'user':      return 'message-user';
      case 'assistant': return 'message-ai';
      case 'system':    return 'message-system';
      default:          return '';
    }
  };

  return (
    <div className={`message ${getMessageClass()}`}>
      {/* Attached image preview */}
      {message.imageDataUrl && (
        <div className="message-image-wrapper">
          <img
            src={message.imageDataUrl}
            alt="Attached"
            className="message-image"
          />
        </div>
      )}

      {/* Text content */}
      {message.role === 'system' ? (
        <span>{message.content}</span>
      ) : (
        <ReactMarkdown>{message.content}</ReactMarkdown>
      )}
    </div>
  );
}
