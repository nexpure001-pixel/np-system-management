import React, { useState, useEffect } from 'react';
import './RequestWorkManagement.css';

const DEFAULT_MEMBERS = [
    { id: 1, name: '岡部MG' },
    { id: 2, name: '岡部CH' },
    { id: 3, name: '松本' },
    { id: 4, name: '野田' },
    { id: 5, name: '阿部' },
];

const loadFromStorage = (key, fallback) => {
    try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : fallback;
    } catch {
        return fallback;
    }
};

const saveToStorage = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));
};

export default function RequestWorkManagement() {
    const [members, setMembers] = useState(() =>
        loadFromStorage('rw_members', DEFAULT_MEMBERS)
    );
    const [requests, setRequests] = useState(() =>
        loadFromStorage('rw_requests', [])
    );

    // Form state
    const [form, setForm] = useState({
        requesterId: '',
        recipientId: '',
        content: '',
    });
    const [formError, setFormError] = useState('');

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);
    const [editingNames, setEditingNames] = useState([]);

    // Tab state
    const [activeTab, setActiveTab] = useState('recipient');

    // Detail modal
    const [detailRequest, setDetailRequest] = useState(null);

    useEffect(() => saveToStorage('rw_members', members), [members]);
    useEffect(() => saveToStorage('rw_requests', requests), [requests]);

    const openSettings = () => {
        setEditingNames(members.map(m => ({ ...m })));
        setShowSettings(true);
    };

    const saveSettings = () => {
        const cleaned = editingNames.map(m => ({
            ...m,
            name: m.name.trim() || m.name,
        }));
        setMembers(cleaned);
        setShowSettings(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('[DEBUG] handleSubmit発火', form);
        if (!form.requesterId) { setFormError('依頼者を選択してください'); return; }
        if (!form.recipientId) { setFormError('受託者を選択してください'); return; }
        if (form.requesterId === form.recipientId) { setFormError('依頼者と受託者は別の人を選択してください'); return; }
        if (!form.content.trim()) { setFormError('依頼内容を入力してください'); return; }

        const newRequest = {
            id: Date.now().toString(),
            requesterId: form.requesterId,
            recipientId: form.recipientId,
            content: form.content.trim(),
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        setRequests(prev => [...prev, newRequest]);
        setForm({ requesterId: '', recipientId: '', content: '' });
        setFormError('');

        // LINE WORKS通知（Supabase Edge Function）
        const requesterName = getMemberName(form.requesterId);
        const recipientName = getMemberName(form.recipientId);
        const requestContent = form.content.trim();
        fetch('https://aosrdhlxfewpqhgjfmjb.supabase.co/functions/v1/notify-lineworks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                requester: requesterName,
                recipient: recipientName,
                content: requestContent,
            }),
        }).catch(err => console.error('通知エラー:', err));
    };

    const completeRequest = (id) => {
        setRequests(prev =>
            prev.map(r => r.id === id ? { ...r, status: 'completed', completedAt: new Date().toISOString() } : r)
        );
        if (detailRequest?.id === id) {
            setDetailRequest(prev => ({ ...prev, status: 'completed', completedAt: new Date().toISOString() }));
        }
    };

    const deleteRequest = (id) => {
        setRequests(prev => prev.filter(r => r.id !== id));
        if (detailRequest?.id === id) setDetailRequest(null);
    };

    const getMemberName = (id) => members.find(m => String(m.id) === String(id))?.name || '不明';

    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const getRequestsForRecipient = (memberId) =>
        requests
            .filter(r => String(r.recipientId) === String(memberId))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const getRequestsForRequester = (memberId) =>
        requests
            .filter(r => String(r.requesterId) === String(memberId))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return (
        <div className="rw-container">
            {/* Header */}
            <div className="rw-header">
                <h1 className="rw-title">依頼業務</h1>
                <button className="rw-settings-btn" onClick={openSettings}>
                    ⚙ メンバー編集
                </button>
            </div>

            {/* Request Form */}
            <form className="rw-form" onSubmit={handleSubmit}>
                <div className="rw-form-row">
                    <div className="rw-form-group">
                        <label>依頼者</label>
                        <select
                            value={form.requesterId}
                            onChange={e => setForm(f => ({ ...f, requesterId: e.target.value }))}
                        >
                            <option value="">選択してください</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rw-form-arrow">→</div>
                    <div className="rw-form-group">
                        <label>受託者</label>
                        <select
                            value={form.recipientId}
                            onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}
                        >
                            <option value="">選択してください</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="rw-form-group rw-form-content">
                        <label>依頼内容</label>
                        <input
                            type="text"
                            placeholder="依頼内容を入力..."
                            value={form.content}
                            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                        />
                    </div>
                    <button type="submit" className="rw-submit-btn">依頼する</button>
                </div>
                {formError && <p className="rw-form-error">{formError}</p>}
            </form>

            {/* Tab Switch */}
            <div className="rw-tabs">
                <button
                    className={`rw-tab ${activeTab === 'recipient' ? 'rw-tab--active' : ''}`}
                    onClick={() => setActiveTab('recipient')}
                >
                    受託者別（依頼を受けた人）
                </button>
                <button
                    className={`rw-tab ${activeTab === 'requester' ? 'rw-tab--active' : ''}`}
                    onClick={() => setActiveTab('requester')}
                >
                    依頼者別（依頼した人）
                </button>
            </div>

            {/* Board */}
            <div className="rw-board">
                {activeTab === 'recipient' && members.map(member => {
                    const reqs = getRequestsForRecipient(member.id);
                    const pendingCount = reqs.filter(r => r.status === 'pending').length;
                    return (
                        <div key={member.id} className="rw-column">
                            <div className="rw-column-header rw-column-header--recipient">
                                <span className="rw-column-name">{member.name}</span>
                                {pendingCount > 0 && (
                                    <span className="rw-badge">{pendingCount}</span>
                                )}
                            </div>
                            <div className="rw-column-body">
                                {reqs.length === 0 && (
                                    <div className="rw-empty">依頼なし</div>
                                )}
                                {reqs.map(req => (
                                    <div
                                        key={req.id}
                                        className={`rw-card ${req.status === 'completed' ? 'rw-card--done' : 'rw-card--pending'}`}
                                        onClick={() => setDetailRequest(req)}
                                    >
                                        <div className="rw-card-from">
                                            {getMemberName(req.requesterId)} → {member.name}
                                        </div>
                                        <div className="rw-card-content">{req.content}</div>
                                        <div className="rw-card-footer">
                                            <span className="rw-card-date">{formatDate(req.createdAt)}</span>
                                            {req.status === 'pending' ? (
                                                <button
                                                    className="rw-complete-btn"
                                                    onClick={e => { e.stopPropagation(); completeRequest(req.id); }}
                                                >
                                                    完了
                                                </button>
                                            ) : (
                                                <span className="rw-done-label">完了済み</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {activeTab === 'requester' && members.map(member => {
                    const reqs = getRequestsForRequester(member.id);
                    const pendingCount = reqs.filter(r => r.status === 'pending').length;
                    return (
                        <div key={member.id} className="rw-column">
                            <div className="rw-column-header rw-column-header--requester">
                                <span className="rw-column-name">{member.name}</span>
                                {pendingCount > 0 && (
                                    <span className="rw-badge">{pendingCount}</span>
                                )}
                            </div>
                            <div className="rw-column-body">
                                {reqs.length === 0 && (
                                    <div className="rw-empty">依頼なし</div>
                                )}
                                {reqs.map(req => (
                                    <div
                                        key={req.id}
                                        className={`rw-card ${req.status === 'completed' ? 'rw-card--done' : 'rw-card--pending'}`}
                                        onClick={() => setDetailRequest(req)}
                                    >
                                        <div className="rw-card-from">
                                            {member.name} → {getMemberName(req.recipientId)}
                                        </div>
                                        <div className="rw-card-content">{req.content}</div>
                                        <div className="rw-card-footer">
                                            <span className="rw-card-date">{formatDate(req.createdAt)}</span>
                                            {req.status === 'completed'
                                                ? <span className="rw-done-label">完了済み</span>
                                                : <span className="rw-pending-label">未完了</span>
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail Modal */}
            {detailRequest && (
                <div className="rw-modal-overlay" onClick={() => setDetailRequest(null)}>
                    <div className="rw-modal" onClick={e => e.stopPropagation()}>
                        <div className={`rw-modal-status ${detailRequest.status === 'completed' ? 'rw-modal-status--done' : 'rw-modal-status--pending'}`}>
                            {detailRequest.status === 'completed' ? '完了' : '未完了'}
                        </div>
                        <h2 className="rw-modal-title">依頼詳細</h2>
                        <table className="rw-modal-table">
                            <tbody>
                                <tr>
                                    <th>依頼者</th>
                                    <td>{getMemberName(detailRequest.requesterId)}</td>
                                </tr>
                                <tr>
                                    <th>受託者</th>
                                    <td>{getMemberName(detailRequest.recipientId)}</td>
                                </tr>
                                <tr>
                                    <th>依頼内容</th>
                                    <td>{detailRequest.content}</td>
                                </tr>
                                <tr>
                                    <th>依頼日時</th>
                                    <td>{formatDate(detailRequest.createdAt)}</td>
                                </tr>
                                {detailRequest.completedAt && (
                                    <tr>
                                        <th>完了日時</th>
                                        <td>{formatDate(detailRequest.completedAt)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="rw-modal-actions">
                            {detailRequest.status === 'pending' && (
                                <button
                                    className="rw-modal-complete-btn"
                                    onClick={() => completeRequest(detailRequest.id)}
                                >
                                    完了にする
                                </button>
                            )}
                            <button
                                className="rw-modal-delete-btn"
                                onClick={() => {
                                    if (window.confirm('この依頼を削除しますか？')) {
                                        deleteRequest(detailRequest.id);
                                    }
                                }}
                            >
                                削除
                            </button>
                            <button
                                className="rw-modal-close-btn"
                                onClick={() => setDetailRequest(null)}
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="rw-modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="rw-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="rw-modal-title">メンバー名の編集</h2>
                        <div className="rw-settings-list">
                            {editingNames.map((m, i) => (
                                <div key={m.id} className="rw-settings-row">
                                    <span className="rw-settings-index">{i + 1}.</span>
                                    <input
                                        type="text"
                                        value={m.name}
                                        onChange={e => {
                                            const updated = [...editingNames];
                                            updated[i] = { ...updated[i], name: e.target.value };
                                            setEditingNames(updated);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="rw-modal-actions">
                            <button className="rw-modal-complete-btn" onClick={saveSettings}>
                                保存
                            </button>
                            <button className="rw-modal-close-btn" onClick={() => setShowSettings(false)}>
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
