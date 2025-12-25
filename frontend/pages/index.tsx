import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Log {
  id: string;
  filename: string;
  level: string;
  timestamp: string;
  owner: string;
}

interface Stat {
  name: string;
  value: number;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [user, setUser] = useState('');
  const [role, setRole] = useState('');
  
  // Filter States
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const router = useRouter();

  // Colors for the chart
  const COLORS: any = {
    INFO: '#3b82f6',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    CRITICAL: '#8b5cf6'
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');
    if (storedUser) {
      setUser(storedUser);
      setRole(storedRole || '');
      fetchData(storedUser, levelFilter, search);
      
      // Auto-refresh simulation data
      const interval = setInterval(() => fetchData(storedUser, levelFilter, search), 3000);
      return () => clearInterval(interval);
    } else {
      router.push('/login');
    }
  }, [levelFilter, search]); // Re-fetch when filters change

  const fetchData = async (username: string, lvl: string, q: string) => {
    try {
      // 1. Fetch Logs with Filters
      const resLogs = await fetch(`http://localhost:5000/api/logs?user=${username}&level=${lvl}&search=${q}`);
      const logData = await resLogs.json();
      setLogs(logData);

      // 2. Fetch Analytics for Chart
      const resStats = await fetch(`http://localhost:5000/api/stats?user=${username}`);
      const statData = await resStats.json();
      setStats(statData);
    } catch (err) {
      console.error("Backend offline");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const openS3Link = (filename: string) => {
    window.open(`http://localhost:5000/s3-view/${filename}`, '_blank');
  };

  const getLevelColor = (level: string) => {
    switch(level) {
      case 'ERROR': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'CRITICAL': return { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' };
      case 'WARNING': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'INFO': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      default: return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
    }
  };

  return (
    <div className="dashboard-page">
      {/* Animated Background */}
      <div className="background-animation">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <div className="logo-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <div className="logo-text">
                <h1>Log Analytics Hub</h1>
                <div className="user-info">
                  <span className="user-label">Account:</span>
                  <span className="username">{user}</span>
                  <span className={`role-badge ${role.toLowerCase()}`}>{role}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="status-badge">
              <span className="status-dot"></span>
              <span>Live Monitoring</span>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Analytics Chart Section */}
          <div className="chart-section">
            <div className="section-header">
              <div className="header-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>
              <div>
                <h2>Live Log Distribution</h2>
                <p>Real-time analytics across all log levels</p>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats}>
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '0.875rem' }}
                  />
                  <YAxis 
                    stroke="rgba(255, 255, 255, 0.5)"
                    style={{ fontSize: '0.875rem' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(26, 26, 26, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#fff', fontSize: '0.875rem' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#888'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <div className="filters-header">
              <div className="filter-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </div>
              <h3>Filters & Search</h3>
            </div>
            <div className="filters-controls">
              <div className="filter-group">
                <label htmlFor="level-filter">Log Level</label>
                <div className="select-wrapper">
                  <select 
                    id="level-filter"
                    value={levelFilter} 
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                  <svg className="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>

              <div className="filter-group search-group">
                <label htmlFor="search-input">Search Logs</label>
                <div className="search-wrapper">
                  <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                  <input 
                    id="search-input"
                    type="text" 
                    placeholder="Search by Log ID or Owner..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="results-count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>{logs.length} results</span>
              </div>
            </div>
          </div>

          {/* Logs Table Section */}
          <div className="logs-section">
            <div className="section-header">
              <div className="header-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div>
                <h2>Detailed Logs</h2>
                <p>Complete log entries with S3 download access</p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3>No Logs Found</h3>
                <p>No logs match your current filter criteria. Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>
                        <div className="th-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>Timestamp</span>
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                          <span>Level</span>
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span>Owner</span>
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span>File ID</span>
                        </div>
                      </th>
                      <th>
                        <div className="th-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="12" cy="5" r="1"></circle>
                            <circle cx="12" cy="19" r="1"></circle>
                          </svg>
                          <span>Action</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => {
                      const levelColor = getLevelColor(log.level);
                      return (
                        <tr key={log.id} className="log-row" style={{ animationDelay: `${index * 0.05}s` }}>
                          <td className="timestamp-cell">
                            <div className="timestamp-content">
                              <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <span className="date">{new Date(log.timestamp).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td>
                            <span 
                              className="level-badge"
                              style={{
                                background: levelColor.bg,
                                color: levelColor.text,
                                border: `1px solid ${levelColor.border}`
                              }}
                            >
                              {log.level}
                            </span>
                          </td>
                          <td className="owner-cell">{log.owner}</td>
                          <td className="filename-cell">
                            <code>{log.filename.substring(0, 25)}...</code>
                          </td>
                          <td>
                            <button className="download-button" onClick={() => openS3Link(log.filename)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <p>Problem Statement #6: Simplify the mechanism of delivery the logs</p>
          <p>Developed by <strong>Alroy & Aniket</strong> | Enterprise Logging Solution</p>
        </div>
      </footer>
    </div>
  );
}