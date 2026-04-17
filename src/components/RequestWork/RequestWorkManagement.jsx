import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './RequestWorkManagement.css';

export default function RequestWorkManagement() {
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({ requesterId: '', recipientId: '', content: '', title: '' });
    const [formError, setFormError] = useState('');

    const [showSettings, setShowSettings] = useState(false);
    const [editingNames, setEditingNames] = useState([]);

    const [activeTab, setActiveTab] = useState('recipient');
    const [detailRequest, setDetailRequest] = useState(null);

    // データ取得
    const fetchMembers = useCallback(async () => {
        const { data } = await supabase.from('work_members').select('*').order('id');
        if (data) setMembers(data);
    }, []);

    const fetchRequests = useCallback(async () => {
        const { data } = await supabase
            .from('work_requests')
            .select('*')
            .order('created_at', { ascending: true });
        if (data) setRequests(data);
    }, []);

    useEffect(() => {
        Promise.all([fetchMembers(), fetchRequests()]).then(() => setLoading(false));

        // リアルタイム同期
        const channel = supabase
            .channel('work_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [fetchMembers, fetchRequests]);

    const getMemberName = (id) => members.find(m => m.id === Number(id))?.name || '不明';

    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.requesterId) { setFormError('依頼者を選択してください'); return; }
        if (!form.recipientId) { setFormError('受託者を選択してください'); return; }
        if (form.requesterId === form.recipientId) { setFormError('依頼者と受託者は別の人を選択してください'); return; }
        if (!form.title.trim()) { setFormError('タイトルを入力してください'); return; }
        if (!form.content.trim()) { setFormError('依頼内容を入力してください'); return; }

        const { error } = await supabase.from('work_requests').insert({
            requester_id: Number(form.requesterId),
            recipient_id: Number(form.recipientId),
            title: form.title.trim(),
            content: form.content.trim(),
            status: 'pending',
        });

        if (error) { setFormError('保存に失敗しました'); return; }

        await fetchRequests(); // 投稿後に即座にボードを更新

        // LINE WORKS通知
        const requesterName = getMemberName(form.requesterId);
        const recipientData = members.find(m => m.id === Number(form.recipientId));
        const recipientName = recipientData?.name || '不明';
        const recipientLineworksId = recipientData?.lineworks_id || '';
        const requestContent = form.content.trim();
        const requestTitle = form.title.trim();
        
        fetch('https://aosrdhlxfewpqhgjfmjb.supabase.co/functions/v1/notify-lineworks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ 
                requester: requesterName, 
                recipient: recipientName, 
                recipientLineworksId, 
                title: requestTitle,
                content: requestContent 
            }),
        }).catch(err => console.error('通知エラー:', err));

        setForm({ requesterId: '', recipientId: '', content: '', title: '' });
        setFormError('');
    };

    const completeMessages = [
        "完了したよ",
        "完了しました",
        "完了したらしいです",
        "任務完遂",
        "ご報告、終わったですます",
        "うぃ（完了）"
    ];

    const completeRequest = async (id) => {
        // 対象の依頼を取得
        const req = requests.find(r => r.id === id) || detailRequest;

        await supabase.from('work_requests').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
        }).eq('id', id);
        await fetchRequests(); // 完了後も即座にボードを更新
        if (detailRequest?.id === id) {
            setDetailRequest(prev => ({ ...prev, status: 'completed', completed_at: new Date().toISOString() }));
        }

        // 完了した旨を依頼者にLINE WORKS通知
        if (req) {
            const requesterData = members.find(m => m.id === req.requester_id);
            const recipientData = members.find(m => m.id === req.recipient_id);
            
            const requesterName = requesterData?.name || '不明';
            const recipientName = recipientData?.name || '不明';
            const requesterLineworksId = requesterData?.lineworks_id || '';
            const customMessage = completeMessages[Math.floor(Math.random() * completeMessages.length)];

            fetch('https://aosrdhlxfewpqhgjfmjb.supabase.co/functions/v1/notify-lineworks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ 
                    type: 'complete', 
                    requester: requesterName, 
                    recipient: recipientName, 
                    title: req.title || 'なし',
                    content: req.content,
                    requesterLineworksId: requesterLineworksId,
                    customMessage: customMessage
                }),
            }).catch(err => console.error('完了通知エラー:', err));
        }
    };

    const deleteRequest = async (id) => {
        await supabase.from('work_requests').delete().eq('id', id);
        await fetchRequests(); // 削除後も即座にボードを更新
        if (detailRequest?.id === id) setDetailRequest(null);
    };

    const openSettings = () => {
        setEditingNames(members.map(m => ({ ...m })));
        setShowSettings(true);
    };

    const saveSettings = async () => {
        for (const m of editingNames) {
            await supabase.from('work_members').update({ 
                name: m.name.trim() || m.name,
                lineworks_id: m.lineworks_id?.trim() || null
            }).eq('id', m.id);
        }
        await fetchMembers();
        setShowSettings(false);
    };

    const getRequestsForRecipient = (memberId) =>
        requests.filter(r => r.recipient_id === memberId);

    const getRequestsForRequester = (memberId) =>
        requests.filter(r => r.requester_id === memberId);

    if (loading) return <div className="rw-container"><div className="rw-empty">読み込み中...</div></div>;

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
                <div className="rw-form-main">
                    <div className="rw-form-top">
                        <div className="rw-form-group">
                            <label>依頼者</label>
                            <select value={form.requesterId} onChange={e => setForm(f => ({ ...f, requesterId: e.target.value }))}>
                                <option value="">選択してください</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div className="rw-form-arrow">→</div>
                        <div className="rw-form-group">
                            <label>受託者</label>
                            <select value={form.recipientId} onChange={e => setForm(f => ({ ...f, recipientId: e.target.value }))}>
                                <option value="">選択してください</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                        <div className="rw-form-group rw-form-title">
                            <label>案件タイトル</label>
                            <input
                                type="text"
                                placeholder="例：〇〇資料の作成"
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="rw-form-bottom">
                        <div className="rw-form-group rw-form-content">
                            <label>具体的な依頼内容</label>
                            <textarea
                                placeholder="詳しい内容を記入してください（改行も反映されます）"
                                value={form.content}
                                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                                rows="3"
                            />
                        </div>
                        <button type="submit" className="rw-submit-btn">依頼を送信</button>
                    </div>
                </div>
                {formError && <p className="rw-form-error">{formError}</p>}
            </form>

            {/* Tab Switch */}
            <div className="rw-tabs">
                <button className={`rw-tab ${activeTab === 'recipient' ? 'rw-tab--active' : ''}`} onClick={() => setActiveTab('recipient')}>
                    受託者別（依頼を受けた人）
                </button>
                <button className={`rw-tab ${activeTab === 'requester' ? 'rw-tab--active' : ''}`} onClick={() => setActiveTab('requester')}>
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
                                {pendingCount > 0 && <span className="rw-badge">{pendingCount}</span>}
                            </div>
                            <div className="rw-column-body">
                                {reqs.length === 0 && <div className="rw-empty">依頼なし</div>}
                                {reqs.map(req => (
                                    <div
                                        key={req.id}
                                        className={`rw-card ${req.status === 'completed' ? 'rw-card--done' : 'rw-card--pending'}`}
                                        onClick={() => setDetailRequest(req)}
                                    >
                                        <div className="rw-card-from" style={{ fontSize: '12px', background: req.status === 'completed' ? '#c6f6d5' : '#fed7d7', padding: '4px 6px', borderRadius: '4px', color: req.status === 'completed' ? '#276749' : '#c53030' }}>
                                            {getMemberName(req.requester_id)} ➔ {member.name}
                                        </div>
                                        <div className="rw-card-title" style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0', color: '#2d3748' }}>
                                            {req.title || '（タイトルなし）'}
                                        </div>
                                        {req.status === 'pending' && (
                                            <div className="rw-card-content" style={{ fontSize: '13px', margin: '4px 0', whiteSpace: 'pre-wrap', color: '#4a5568' }}>
                                                {req.content}
                                            </div>
                                        )}
                                        <div className="rw-card-footer">
                                            <span className="rw-card-date">{formatDate(req.created_at)}</span>
                                            {req.status === 'pending' ? (
                                                <button className="rw-complete-btn" onClick={e => { e.stopPropagation(); completeRequest(req.id); }}>完了</button>
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
                                {pendingCount > 0 && <span className="rw-badge">{pendingCount}</span>}
                            </div>
                            <div className="rw-column-body">
                                {reqs.length === 0 && <div className="rw-empty">依頼なし</div>}
                                {reqs.map(req => (
                                    <div
                                        key={req.id}
                                        className={`rw-card ${req.status === 'completed' ? 'rw-card--done' : 'rw-card--pending'}`}
                                        onClick={() => setDetailRequest(req)}
                                    >
                                        <div className="rw-card-from" style={{ fontSize: '12px', background: req.status === 'completed' ? '#c6f6d5' : '#fed7d7', padding: '4px 6px', borderRadius: '4px', color: req.status === 'completed' ? '#276749' : '#c53030' }}>
                                            {member.name} ➔ {getMemberName(req.recipient_id)}
                                        </div>
                                        <div className="rw-card-title" style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0', color: '#2d3748' }}>
                                            {req.title || '（タイトルなし）'}
                                        </div>
                                        {req.status === 'pending' && (
                                            <div className="rw-card-content" style={{ fontSize: '13px', margin: '4px 0', whiteSpace: 'pre-wrap', color: '#4a5568' }}>
                                                {req.content}
                                            </div>
                                        )}
                                        <div className="rw-card-footer">
                                            <span className="rw-card-date">{formatDate(req.created_at)}</span>
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
                                <tr><th>依頼者</th><td>{getMemberName(detailRequest.requester_id)}</td></tr>
                                <tr><th>受託者</th><td>{getMemberName(detailRequest.recipient_id)}</td></tr>
                                <tr><th>タイトル</th><td style={{ fontWeight: 'bold' }}>{detailRequest.title || 'なし'}</td></tr>
                                <tr><th>依頼内容</th><td style={{ whiteSpace: 'pre-wrap' }}>{detailRequest.content}</td></tr>
                                <tr><th>依頼日時</th><td>{formatDate(detailRequest.created_at)}</td></tr>
                                {detailRequest.completed_at && (
                                    <tr><th>完了日時</th><td>{formatDate(detailRequest.completed_at)}</td></tr>
                                )}
                            </tbody>
                        </table>
                        <div className="rw-modal-actions">
                            {detailRequest.status === 'pending' && (
                                <button className="rw-modal-complete-btn" onClick={() => completeRequest(detailRequest.id)}>完了にする</button>
                            )}
                            <button className="rw-modal-delete-btn" onClick={() => { if (window.confirm('この依頼を削除しますか？')) deleteRequest(detailRequest.id); }}>削除</button>
                            <button className="rw-modal-close-btn" onClick={() => setDetailRequest(null)}>閉じる</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="rw-modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="rw-modal" onClick={e => e.stopPropagation()}>
                        <h2 className="rw-modal-title">メンバー・LINE通知設定</h2>
                        <div className="rw-settings-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {editingNames.map((m, i) => (
                                <div key={m.id} className="rw-settings-row flex flex-col gap-2 p-2 border-b">
                                    <div className="flex items-center gap-2">
                                        <span className="rw-settings-index">{i + 1}.</span>
                                        <input
                                            type="text"
                                            placeholder="お名前"
                                            value={m.name || ''}
                                            onChange={e => {
                                                const updated = [...editingNames];
                                                updated[i] = { ...updated[i], name: e.target.value };
                                                setEditingNames(updated);
                                            }}
                                            className="flex-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pl-6">
                                        <span className="text-xs text-slate-500 whitespace-nowrap">LINE ID (userNo):</span>
                                        <input
                                            type="text"
                                            placeholder="例: 110002509649274"
                                            value={m.lineworks_id || ''}
                                            onChange={e => {
                                                const updated = [...editingNames];
                                                updated[i] = { ...updated[i], lineworks_id: e.target.value };
                                                setEditingNames(updated);
                                            }}
                                            className="text-sm flex-1 opacity-80"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="rw-modal-actions">
                            <button className="rw-modal-complete-btn" onClick={saveSettings}>保存</button>
                            <button className="rw-modal-close-btn" onClick={() => setShowSettings(false)}>キャンセル</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
