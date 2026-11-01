import { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Trash2, Database, CheckCircle2, Lock, RotateCcw, Check, X, Info } from 'lucide-react';
import { getAgents, getScenarios, runScenario } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import RiskRing from '../components/RiskRing';

const iconMap = {
  KeyRound,
  ShieldAlert,
  Trash2,
  Database,
  CheckCircle2,
  Lock
};

const severityColors = {
  CRITICAL: '#e5484d',
  HIGH: '#f76b15',
  MEDIUM: '#e5b611',
  LOW: '#0ea472'
};

const SimulateActivity = () => {
  const [agents, setAgents] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [agentsData, scenariosData] = await Promise.all([
          getAgents(),
          getScenarios()
        ]);
        setAgents(agentsData);
        // Handle both response formats: array or {scenarios: [...]}
        setScenarios(scenariosData.scenarios || scenariosData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load agents and scenarios');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleScenarioExecute = async (scenario) => {
    if (!selectedAgent || running) return;

    setRunning(true);
    setCurrentStep(0);
    setResult(null);
    setError(null);

    const totalSteps = scenario.steps?.length || 3;
    
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < totalSteps - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 700);

    try {
      const response = await runScenario(scenario.id, selectedAgent.agent.id);
      clearInterval(stepInterval);
      setCurrentStep(totalSteps);
      setResult(response);
    } catch (err) {
      clearInterval(stepInterval);
      console.error('Scenario execution failed:', err);
      setError(err.message || 'Scenario execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCurrentStep(0);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="spinner-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="alert alert-info mb-5 animate-fade-in">
        <Info size={18} />
        <span>
          Execute real AWS API calls against the Floci local cloud emulator. Each scenario triggers actual boto3 operations that are captured by CloudTrail and analyzed by the behavioral monitoring engine.
        </span>
      </div>

      <div className="card mb-5">
        <div className="card-header">
          <div className="card-title">
            <span style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#5b6ef5',
              fontSize: '13px',
              fontWeight: 700,
              marginRight: '10px'
            }}>
              1
            </span>
            Select Target Agent
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          paddingBottom: '4px',
          marginTop: '16px'
        }}>
          {agents.map(agentData => {
            const isSelected = selectedAgent?.agent.id === agentData.agent.id;
            return (
              <div
                key={agentData.agent.id}
                onClick={() => setSelectedAgent(agentData)}
                style={{
                  minWidth: '220px',
                  padding: '12px 16px',
                  border: isSelected ? '2px solid #5b6ef5' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  background: isSelected ? 'rgba(91, 110, 245, 0.08)' : '#0f1117',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8e9f0', marginBottom: '8px' }}>
                  {agentData.agent.name}
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-blue" style={{ fontSize: '10px' }}>
                    {agentData.agent.environment}
                  </span>
                  <RiskBadge level={agentData.latest_risk_level} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedAgent && !running && !result && (
        <div className="card mb-5 animate-fade-in">
          <div className="card-header mb-4">
            <div className="card-title">
              <span style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#5b6ef5',
                fontSize: '13px',
                fontWeight: 700,
                marginRight: '10px'
              }}>
                2
              </span>
              Choose Attack Scenario
            </div>
          </div>

          <div className="grid-3 gap-4">
            {scenarios.map(scenario => {
              const IconComponent = iconMap[scenario.icon] || ShieldAlert;
              const severityColor = severityColors[scenario.severity] || '#7a7d93';

              return (
                <div
                  key={scenario.id}
                  className="card-sm"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: `3px solid ${severityColor}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = severityColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  onClick={() => handleScenarioExecute(scenario)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '6px',
                      background: `${severityColor}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: severityColor,
                      flexShrink: 0
                    }}>
                      <IconComponent size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8e9f0', marginBottom: '4px' }}>
                        {scenario.name}
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {scenario.category}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: '#7a7d93',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: '36px'
                  }}>
                    {scenario.description}
                  </div>

                  {scenario.steps && scenario.steps.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      {scenario.steps.slice(0, 3).map((step, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            fontSize: '11px', 
                            color: '#4a4d62', 
                            marginBottom: '3px',
                            paddingLeft: '14px',
                            position: 'relative'
                          }}
                        >
                          <span style={{ position: 'absolute', left: 0 }}>{idx + 1}.</span>
                          {step}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <RiskBadge level={scenario.severity} />
                    <div style={{ fontSize: '12px', color: '#5b6ef5', fontWeight: 500 }}>
                      Execute →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {running && selectedAgent && (
        <div className="card mb-5 animate-fade-in">
          <div style={{ 
            padding: '20px',
            borderRadius: '8px',
            background: 'rgba(91, 110, 245, 0.05)',
            border: '1px solid rgba(91, 110, 245, 0.2)',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e8e9f0', marginBottom: '6px' }}>
              Executing: {scenarios.find(s => running)?.name || 'Attack scenario'} on {selectedAgent.agent.name}
            </div>
            <div style={{ fontSize: '12px', color: '#7a7d93' }}>
              Making real boto3 calls to Floci...
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {scenarios[0]?.steps?.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;
              const isPending = idx > currentStep;

              return (
                <div key={idx} className="flex items-center gap-3">
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: isPending ? '2px solid rgba(255,255,255,0.12)' : 'none',
                    background: isCompleted ? '#0ea472' : isCurrent ? '#5b6ef5' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isCompleted ? (
                      <Check size={14} style={{ color: '#fff' }} />
                    ) : isCurrent ? (
                      <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                    ) : null}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: isCompleted ? '#0ea472' : isCurrent ? '#e8e9f0' : '#4a4d62',
                    fontWeight: isCurrent ? 600 : 400
                  }}>
                    {step}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && (
        <div className="grid-2 gap-5 animate-fade-in">
          <div className="card">
            <div className="card-header mb-4">
              <div className="card-title">Risk Analysis</div>
            </div>

            <div className="flex flex-col items-center mb-4">
              <RiskRing score={result.risk_score} size={100} strokeWidth={7} />
            </div>

            <div className="flex items-center justify-center mb-4">
              <RiskBadge level={result.risk_level} score={result.risk_score} />
            </div>

            <div style={{
              fontSize: '13px',
              color: '#7a7d93',
              lineHeight: '1.6',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              {result.explanation || 'The executed scenario triggered anomalous behavioral patterns that deviate from the agent\'s established baseline.'}
            </div>

            {result.risk_factors && result.risk_factors.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8e9f0', marginBottom: '8px' }}>
                  Risk Factors
                </div>
                <div className="flex flex-col gap-2">
                  {result.risk_factors.map((factor, idx) => (
                    <span key={idx} className="badge badge-critical">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8e9f0', marginBottom: '8px' }}>
                  Recommendations
                </div>
                <ol style={{ 
                  margin: 0, 
                  paddingLeft: '20px',
                  fontSize: '12px',
                  color: '#7a7d93',
                  lineHeight: '1.6'
                }}>
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header mb-4">
              <div className="card-title">Execution Details</div>
            </div>

            {result.events && result.events.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8e9f0', marginBottom: '10px' }}>
                  AWS Calls Made
                </div>
                <div className="flex flex-col gap-2">
                  {result.events.map((event, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: '#0f1117',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="tag" style={{ fontSize: '10px' }}>
                          {event.service || 'AWS'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e8e9f0' }}>
                          {event.action}
                        </span>
                      </div>
                      <div className="mono truncate" style={{ fontSize: '11px', color: '#7a7d93' }}>
                        {event.resource || event.resource_name || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e5484d', marginBottom: '10px' }}>
                  Errors
                </div>
                <div className="flex flex-col gap-2">
                  {result.errors.map((err, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(229, 72, 77, 0.05)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#e5484d'
                      }}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              className="btn btn-primary"
              onClick={handleReset}
              style={{ width: '100%' }}
            >
              <RotateCcw size={16} />
              Run Another Scenario
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-critical animate-fade-in">
          <X size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default SimulateActivity;
