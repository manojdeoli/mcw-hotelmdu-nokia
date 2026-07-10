// =============================================================================
// Validation Timeline Component
// src/transport/components/ValidationTimeline.js
//
// Gap 3.5 Fix: Clear representation of Network → Device → Barrier flow
// NFC update: step 4 now handles both NFC card-tap and biometric as valid
//             identity verification methods. Shows tag UID when NFC was used.
// =============================================================================

import React from 'react';

export function ValidationTimeline({
  advisoryData,
  deviceStatus,
  validationResult,
  journeyStatus
}) {
  const getStepStatus = (step) => {
    const validationDone = validationResult?.validationStatus === 'SUCCESS' ||
                           validationResult?.validationStatus === 'FAILED';
    switch (step) {
      case 'advisory':
        return advisoryData ? 'completed' : 'pending';
      case 'modeSwitch':
        // During journey (no advisory yet): show in-progress to indicate CAMARA detection running
        return (advisoryData && deviceStatus?.mode === 'TRANSPORT') ? 'completed' :
               advisoryData ? 'in-progress' :
               journeyStatus === 'IN_TRANSIT' ? 'in-progress' : 'pending';
      case 'proximity':
        // Completed if device is near barrier OR if validation has already resolved
        // (device was clearly at barrier — no need to keep it pending after the fact)
        return (deviceStatus?.nearBarrier || validationDone) ? 'completed' :
               deviceStatus?.mode === 'TRANSPORT' ? 'in-progress' : 'pending';
      case 'identity':
        // Completed by NFC, BIOMETRIC, or MOCK (simulated barrier scan)
        return (validationResult?.validationMethod === 'NFC'      ||
                validationResult?.validationMethod === 'BIOMETRIC' ||
                validationResult?.validationMethod === 'MOCK') ? 'completed' :
               (deviceStatus?.nearBarrier || validationResult?.validationStatus === 'PENDING')
                 ? 'in-progress' : 'pending';
      case 'validation':
        return validationResult?.validationStatus === 'SUCCESS' ? 'completed' :
               validationResult?.validationStatus === 'FAILED'  ? 'failed' :
               deviceStatus?.nearBarrier ? 'in-progress' : 'pending';
      default:
        return 'pending';
    }
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':   return '✅';
      case 'in-progress': return '🔄';
      case 'failed':      return '❌';
      default:            return '⏳';
    }
  };

  // Derive identity verification description based on which method resolved it
  const identityDescription = (() => {
    const method = validationResult?.validationMethod;
    const status = validationResult?.validationStatus;
    if (method === 'NFC') {
      const tagId = validationResult?.tagId;
      return `NFC card verified${tagId ? ' — UID: ' + tagId : ''}`;
    }
    if (method === 'BIOMETRIC') {
      return `Biometric verified at ${new Date(validationResult.validationTimestamp).toLocaleTimeString()}`;
    }
    if (method === 'MOCK') {
      return 'Barrier scan simulated — identity verified';
    }
    // Validation is pending — waiting for user action
    if (status === 'PENDING') {
      return advisoryData?.validationRequired
        ? 'Tap card or use Simulate Barrier Detection button...'
        : 'Identity check not required';
    }
    if (deviceStatus?.nearBarrier) {
      return advisoryData?.validationRequired
        ? 'Present card or verify identity at barrier...'
        : 'Identity check not required';
    }
    return 'Waiting for barrier proximity...';
  })();

  const steps = [
    {
      key: 'advisory',
      title: '1. Advisory Triggered',
      description: advisoryData ?
        `${advisoryData.reason} — Signal: ${advisoryData.validationSignal}` :
        'Waiting for correlation analysis...'
    },
    {
      key: 'modeSwitch',
      title: '2. CAMARA Detection & Mode',
      description: deviceStatus?.mode === 'TRANSPORT' ?
        'Device switched to TRANSPORT mode' :
        advisoryData ? 'Switching device mode...' :
        journeyStatus === 'IN_TRANSIT' ? 'CAMARA detecting journey in progress...' :
        journeyStatus === 'COMPLETED'  ? 'Journey detected — correlation complete' :
        'Waiting for advisory...'
    },
    {
      key: 'proximity',
      title: '3. Barrier Proximity Detected',
      description: (deviceStatus?.nearBarrier ||
                    validationResult?.validationStatus === 'SUCCESS' ||
                    validationResult?.validationStatus === 'FAILED') ?
        `BLE signal: ${deviceStatus?.bleSignal ?? -65}dBm — device at barrier` :
        deviceStatus?.mode === 'TRANSPORT'
          ? 'Scanning for barrier proximity...'
          : 'Waiting for device activation...'
    },
    {
      key: 'identity',
      title: '4. Identity Verification',
      description: identityDescription
    },
    {
      key: 'validation',
      title: '5. Validation Completed',
      description: validationResult?.validationStatus === 'SUCCESS' ?
        `Validation successful via ${validationResult.validationMethod === 'MOCK' ? 'Simulation' : validationResult.validationMethod}` :
        validationResult?.validationStatus === 'FAILED' ?
        `Validation failed via ${validationResult.validationMethod === 'MOCK' ? 'Simulation' : validationResult.validationMethod}` :
        'Waiting for validation...'
    }
  ];

  const getTimelineProgress = () => {
    const completedSteps = steps.filter(step => getStepStatus(step.key) === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  return (
    <div className="validation-timeline">
      <div className="timeline-header">
        <h4>🔄 Hybrid Validation Flow</h4>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${getTimelineProgress()}%` }}
          />
        </div>
        <span className="progress-text">{getTimelineProgress()}% Complete</span>
      </div>

      <div className="timeline-steps">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key);
          return (
            <div key={step.key} className={`timeline-step ${status}`}>
              <div className="step-indicator">
                <span className="step-icon">{getStepIcon(status)}</span>
                {index < steps.length - 1 && (
                  <div className={`step-connector ${status === 'completed' ? 'completed' : ''}`} />
                )}
              </div>
              <div className="step-content">
                <div className="step-title">{step.title}</div>
                <div className="step-description">{step.description}</div>
                {step.key === 'advisory' && advisoryData && (
                  <div className="step-details">
                    <span className={`badge ${advisoryData.validationRequired ? 'validation-required' : 'auto-process'}`}>
                      {advisoryData.validationRequired ? 'Validation Required' : 'Auto Process'}
                    </span>
                    {advisoryData.validationSignal === 'AMBIGUOUS' && (
                      <span className="badge nfc-active">NFC Active</span>
                    )}
                    {advisoryData.validationSignal === 'AMBIGUOUS' && (
                      <span className="badge rf-detection">BLE Detection Active</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Panel */}
      <div className="timeline-summary">
        <div className="summary-row">
          <span>Journey ID:</span>
          <span>{advisoryData?.journeyId || 'Not assigned'}</span>
        </div>
        <div className="summary-row">
          <span>Device ID:</span>
          <span>{deviceStatus?.deviceId || 'Not connected'}</span>
        </div>
        <div className="summary-row">
          <span>Validation Method:</span>
          <span>
            {validationResult?.validationMethod === 'MOCK'
              ? 'Simulation'
              : validationResult?.validationMethod || '—'}
          </span>
        </div>
        {validationResult?.tagId && (
          <div className="summary-row">
            <span>NFC Tag UID:</span>
            <span>{validationResult.tagId}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Flow Type:</span>
          <span>
            {deviceStatus?.isConnected === false ?
              '🌐 Network-Only (Device Offline)' :
              '🔄 Hybrid (Network + Device)'}
          </span>
        </div>
      </div>

      <style jsx>{`
        .validation-timeline {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .timeline-header {
          margin-bottom: 20px;
        }

        .timeline-header h4 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #45a049);
          transition: width 0.5s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
        }

        .timeline-steps {
          margin: 20px 0;
        }

        .timeline-step {
          display: flex;
          margin-bottom: 16px;
          position: relative;
        }

        .step-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-right: 16px;
        }

        .step-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          background: #f9f9f9;
          border: 2px solid #ddd;
        }

        .timeline-step.completed .step-icon {
          background: #e8f5e8;
          border-color: #4CAF50;
        }

        .timeline-step.in-progress .step-icon {
          background: #fff3cd;
          border-color: #ffc107;
          animation: pulse 1.5s infinite;
        }

        .timeline-step.failed .step-icon {
          background: #f8d7da;
          border-color: #dc3545;
        }

        .step-connector {
          width: 2px;
          height: 40px;
          background: #ddd;
          margin-top: 8px;
        }

        .step-connector.completed {
          background: #4CAF50;
        }

        .step-content {
          flex: 1;
          padding-top: 4px;
        }

        .step-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .step-description {
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }

        .step-details {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.validation-required {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }

        .badge.auto-process {
          background: #e8f5e8;
          color: #2d5a2d;
          border: 1px solid #c3e6c3;
        }

        .badge.nfc-active {
          background: #e8f4e8;
          color: #1a6b1a;
          border: 1px solid #a8d5a8;
        }

        .badge.rf-detection {
          background: #e7f3ff;
          color: #0066cc;
          border: 1px solid #b3d9ff;
        }

        .timeline-summary {
          border-top: 1px solid #eee;
          padding-top: 16px;
          margin-top: 20px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .summary-row span:first-child {
          color: #666;
        }

        .summary-row span:last-child {
          font-weight: 600;
          color: #333;
        }

        @keyframes pulse {
          0%   { opacity: 1; }
          50%  { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default ValidationTimeline;
