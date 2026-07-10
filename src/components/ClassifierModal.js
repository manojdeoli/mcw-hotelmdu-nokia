import React, { useState } from 'react';

// =============================================================================
// ClassifierModal
//
// Shown on app load when window.DEFAULT_CLASSIFIER_OVERRIDE is not set.
// This happens when running via `npm start` (development mode).
//
// When running via START_APP.bat (production), the BAT file prompts for the
// classifier choice at the terminal and injects it as
// window.DEFAULT_CLASSIFIER_OVERRIDE — this modal is skipped entirely.
//
// Props:
//   onConfirm(classifierType) — called when user clicks Start Demo
// =============================================================================

const OPTIONS = [
  {
    value: 'RULE_BASED',
    icon: '📋',
    title: 'Rule-Based Classifier',
    subtitle: 'Default — Random Forest derived',
    description: 'Deterministic rules informed by offline Random Forest analysis of the Kaggle Customer Segmentation dataset. Fast, transparent, fully auditable. Each decision traces to a single matched rule.',
    badge: 'DEFAULT',
    badgeColor: '#28a745',
  },
  {
    value: 'TREE_BASED',
    icon: '🌳',
    title: 'Tree-Based Classifier',
    subtitle: 'Decision Tree with membership branching',
    description: 'Hierarchical decision tree derived from offline Decision Tree analysis. Supports Premium/Loyalty membership branching. Full node path recorded in trace for explainability.',
    badge: 'MEMBERSHIP AWARE',
    badgeColor: '#1a73e8',
  },
];

function ClassifierModal({ onConfirm }) {
  const [selected, setSelected] = useState('RULE_BASED');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
    }}>
      <div style={{
        background: '#1e2a3a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '32px',
        width: '480px',
        maxWidth: '95vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        color: 'white',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '6px' }}>
            🧠 Customer Profiling
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
            Select the classification engine for this demo session.
            This choice determines how guest profiles are derived from verified session signals.
          </div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              style={{
                background: selected === opt.value
                  ? 'rgba(26, 115, 232, 0.18)'
                  : 'rgba(255,255,255,0.04)',
                border: selected === opt.value
                  ? '2px solid #1a73e8'
                  : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'white',
                transition: 'all 0.15s ease',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>

                {/* Radio indicator */}
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: selected === opt.value ? '5px solid #1a73e8' : '2px solid rgba(255,255,255,0.4)',
                  flexShrink: 0,
                  marginTop: '2px',
                  background: selected === opt.value ? 'white' : 'transparent',
                  transition: 'all 0.15s ease',
                }} />

                <div style={{ flex: 1 }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{opt.title}</span>
                    <span style={{
                      background: opt.badgeColor,
                      color: 'white',
                      fontSize: '0.62rem',
                      fontWeight: 'bold',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      letterSpacing: '0.04em',
                    }}>
                      {opt.badge}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                    {opt.subtitle}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                    {opt.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Dataset note */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: '1.5',
          marginBottom: '24px',
        }}>
          📊 Both classifiers use config derived offline from the Kaggle Customer Segmentation
          dataset. No dataset is loaded at runtime. No personal data is collected.
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm(selected)}
          style={{
            width: '100%',
            background: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '13px',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Start Demo →
        </button>

      </div>
    </div>
  );
}

export default ClassifierModal;
