import { useState, useEffect } from 'react';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    parseISO,
    isValid
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
    ChevronLeft, 
    ChevronRight, 
    CheckCircle2, 
    Circle, 
    AlertCircle, 
    Plus,
    Clock,
    X,
    Trash2,
    Save,
    Calendar as CalendarIcon,
    AlertTriangle,
    EyeOff,
    Eye,
    LayoutGrid,
    List,
    Settings,
    Bell,
    CheckSquare,
    Paperclip,
    Zap
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    setDoc,
    Timestamp 
} from 'firebase/firestore';
import Papa from 'papaparse';
import './ScheduleManagement.css';

const CATEGORIES = [
    { id: 'customer', label: 'カスタマー', bg: '#FFEBEE', color: '#B71C1C', dot: '#F48FB1' },
    { id: 'store', label: '店舗', bg: '#FFF3E0', color: '#E65100', dot: '#FFB74D' },
    { id: 'autoship', label: 'オートシップ', bg: '#E8F5E9', color: '#1B5E20', dot: '#81C784' },
    { id: 'billing', label: '請求', bg: '#E3F2FD', color: '#0D47A1', dot: '#64B5F6' },
];

// 2026年 日本の祝日（天皮日・敷替休日含む）
const HOLIDAYS_2026 = new Set([
    '2026-01-01', // 元日
    '2026-01-12', // 成人の日
    '2026-02-11', // 建国記念の日
    '2026-02-23', // 天皇誕生日
    '2026-03-20', // 春分の日
    '2026-04-29', // 昭和の日
    '2026-05-03', // 憲法記念日
    '2026-05-04', // みどりの日
    '2026-05-05', // こどもの日
    '2026-05-06', // 敷替休日（5/3が日曜のため）
    '2026-07-20', // 海の日
    '2026-08-11', // 山の日
    '2026-09-21', // 敬老の日
    '2026-09-22', // 国民の休日（敷替）
    '2026-09-23', // 秋分の日
    '2026-10-12', // スポーツの日
    '2026-11-03', // 文化の日
    '2026-11-23', // 勤労感謞の日
]);

const isHoliday = (date) => HOLIDAYS_2026.has(format(date, 'yyyy-MM-dd'));

const ScheduleManagement = () => {
    const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [viewMode, setViewMode] = useState('month');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isImporting, setIsImporting] = useState(false);

    const [editForm, setEditForm] = useState({
        title: '', category: 'customer', date: format(new Date(), 'yyyy-MM-dd'), 
        isImportant: false, description: '', subtasks: [], memo: '',
        isUrgent: false, urgentDeadline: '',
        assignee: '',
        repeatType: 'none', repeatConfig: { date: 1, weekday: 1, nth: 1 }, isRepeatTemplate: false
    });
    const [sharedMemos, setSharedMemos] = useState({});
    const [operatorName, setOperatorName] = useState(() => localStorage.getItem('schedule_operator') || '');

    useEffect(() => {
        const q = query(collection(db, 'schedule_tasks'), orderBy('created_at', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskList = snapshot.docs.map(doc => {
                const data = doc.data();
                let taskDate;
                if (data.date instanceof Timestamp) taskDate = data.date.toDate();
                else if (typeof data.date === 'string') taskDate = parseISO(data.date);
                else taskDate = new Date();
                return { id: doc.id, ...data, date: isValid(taskDate) ? taskDate : new Date() };
            });
            setTasks(taskList);
            if (selectedTask) {
                const updated = taskList.find(t => t.id === selectedTask.id);
                if (updated) setSelectedTask(updated);
            }
        });
        return () => unsubscribe();
    }, [selectedTask?.id]);

    useEffect(() => {
        const unsubMemos = onSnapshot(collection(db, 'shared_memos'), (snapshot) => {
            const memos = {};
            snapshot.docs.forEach(d => { memos[d.id] = d.data().text || ''; });
            setSharedMemos(memos);
        });
        return () => unsubMemos();
    }, []);

    const handleMemoChange = async (weekKey, text) => {
        setSharedMemos(prev => ({ ...prev, [weekKey]: text }));
        try {
            await setDoc(doc(db, 'shared_memos', weekKey), { text, updated_at: Timestamp.now() });
        } catch (err) { console.error('メモ保存失敗', err); }
    };

    // 操作ログ記録
    const logAction = async (taskId, action, before = null, after = null) => {
        try {
            await addDoc(collection(db, 'task_logs'), {
                task_id: taskId,
                action,
                before,
                after,
                operator: operatorName || '未設定',
                operated_at: Timestamp.now()
            });
        } catch (err) { console.error('ログ記録失敗', err); }
    };

    // 自動リピート生成（ページ読み込み時に実行）
    useEffect(() => {
        if (!tasks.length) return;
        const now = new Date();
        const yearMonth = format(now, 'yyyy-MM');
        const templates = tasks.filter(t => t.isRepeatTemplate && t.repeatType !== 'none');
        templates.forEach(async (tmpl) => {
            // 当月分がすでに生成済みかチェック
            const alreadyExists = tasks.some(t => t.generatedFromTemplate === tmpl.id && t.generatedFor === yearMonth);
            if (alreadyExists) return;
            let targetDate = null;
            const y = now.getFullYear(), m = now.getMonth();
            if (tmpl.repeatType === 'monthly_date') {
                const d = parseInt(tmpl.repeatConfig?.date || 1);
                targetDate = new Date(y, m, d);
            } else if (tmpl.repeatType === 'weekly') {
                // 最初の対象曜日を生成
                const wd = parseInt(tmpl.repeatConfig?.weekday ?? 1);
                const first = new Date(y, m, 1);
                const diff = (wd - first.getDay() + 7) % 7;
                targetDate = new Date(y, m, 1 + diff);
            } else if (tmpl.repeatType === 'monthly_nth') {
                // 第N曜日
                const wd = parseInt(tmpl.repeatConfig?.weekday ?? 1);
                const nth = parseInt(tmpl.repeatConfig?.nth ?? 1);
                const first = new Date(y, m, 1);
                const diff = (wd - first.getDay() + 7) % 7;
                targetDate = new Date(y, m, 1 + diff + (nth - 1) * 7);
            }
            if (!targetDate) return;
            await addDoc(collection(db, 'schedule_tasks'), {
                title: tmpl.title,
                category: tmpl.category,
                description: tmpl.description || '',
                memo: tmpl.memo || '',
                date: format(targetDate, 'yyyy-MM-dd'),
                completed: false,
                isImportant: tmpl.isImportant || false,
                isUrgent: false,
                generatedFromTemplate: tmpl.id,
                generatedFor: yearMonth,
                created_at: Timestamp.now()
            });
        });
    }, [tasks.length]);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));

    const filteredTasks = tasks.filter(t => filterCategory === 'all' || t.category === filterCategory);

    // 緊急アラート・バッジ用
    const now = new Date();
    const urgentOverdueTasks = tasks.filter(t => t.isUrgent && !t.completed && t.urgentDeadline && new Date(t.urgentDeadline) < now);
    const urgentPendingCount = tasks.filter(t => t.isUrgent && !t.completed).length;

    const openDetails = (task) => {
        setSelectedTask(task);
        setEditForm({
            title: task.title || '', category: task.category || 'customer', date: format(task.date, 'yyyy-MM-dd'),
            isImportant: task.isImportant || false, description: task.description || '', subtasks: task.subtasks || [], memo: task.memo || '',
            isUrgent: task.isUrgent || false, urgentDeadline: task.urgentDeadline || '',
            assignee: task.assignee || '',
            repeatType: task.repeatType || 'none',
            repeatConfig: task.repeatConfig || { date: 1, weekday: 1, nth: 1 },
            isRepeatTemplate: task.isRepeatTemplate || false
        });
        setIsPanelOpen(true);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const taskData = { ...editForm, updated_at: Timestamp.now() };
        try {
            if (selectedTask) {
                await updateDoc(doc(db, 'schedule_tasks', selectedTask.id), taskData);
                await logAction(selectedTask.id, 'タスク更新', { title: selectedTask.title }, { title: editForm.title });
            } else {
                const ref = await addDoc(collection(db, 'schedule_tasks'), { ...taskData, completed: false, created_at: Timestamp.now() });
                await logAction(ref.id, 'タスク作成', null, { title: editForm.title });
            }
            setIsPanelOpen(false);
        } catch (err) { alert("保存に失敗しました"); }
    };

    const toggleTask = async (taskId, currentStatus) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t));
        if (selectedTask?.id === taskId) setSelectedTask(prev => ({ ...prev, completed: !currentStatus }));
        try { 
            await updateDoc(doc(db, 'schedule_tasks', taskId), { 
                completed: !currentStatus, 
                completed_at: !currentStatus ? Timestamp.now() : null 
            });
            await logAction(taskId, !currentStatus ? '完了' : '完了解除', { completed: currentStatus }, { completed: !currentStatus });
        } catch (err) { console.error(err); }
    };

    const handleDelete = async () => {
        if (!selectedTask || !window.confirm("このタスクを削除しますか？")) return;
        try { 
            await logAction(selectedTask.id, '削除', { title: selectedTask.title }, null);
            await deleteDoc(doc(db, 'schedule_tasks', selectedTask.id)); 
            setIsPanelOpen(false); 
        } catch (err) { console.error(err); }
    };

    const importCSVData = async () => {
        setIsImporting(true);
        try {
            const response = await fetch('/schedule_202604.csv');
            const csvText = await response.text();
            const results = Papa.parse(csvText, { header: false });
            const data = results.data;
            const newTasks = [];
            let currentWeekDates = [null, null, null, null, null, null, null, null];
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const firstCol = row[0] || '';
                if (firstCol.startsWith('week')) {
                    currentWeekDates = [null];
                    for (let c = 1; c <= 6; c++) {
                        const dayVal = row[c]?.trim();
                        if (dayVal && !isNaN(dayVal)) currentWeekDates[c] = parseInt(dayVal);
                        else currentWeekDates[c] = null;
                    }
                    continue;
                }
                const categoryMap = { 'カスタマー': 'customer', '店舗': 'store', 'オートシップ': 'autoship', '請求': 'billing' };
                if (categoryMap[firstCol]) {
                    const categoryId = categoryMap[firstCol];
                    for (let c = 1; c <= 6; c++) {
                        const dayDate = currentWeekDates[c];
                        const taskText = row[c]?.trim();
                        if (dayDate && taskText) {
                            newTasks.push({
                                title: taskText.split('\n')[0],
                                description: taskText,
                                category: categoryId,
                                date: format(new Date(2026, 3, dayDate), 'yyyy-MM-dd'),
                                completed: false,
                                isImportant: taskText.includes('⚠️') || taskText.includes('【〆切】'),
                                created_at: Timestamp.now()
                            });
                        }
                    }
                }
            }
            for (const t of newTasks) await addDoc(collection(db, 'schedule_tasks'), t);
            alert(`${newTasks.length}件取り込みました`);
        } catch (err) { alert("失敗しました"); }
        setIsImporting(false);
    };

    return (
        <div className="schedule-ux-wrapper">
            {urgentOverdueTasks.length > 0 && (
                <div className="eva-alert">
                    <div className="eva-stripes" />
                    <div className="eva-content">
                        <span className="eva-label">SYSTEM ALERT</span>
                        <Zap size={20} className="eva-icon" />
                        <span className="eva-text">WARNING：重要タスクの最終取組み日時を超過しました。直ちに確認してください。</span>
                        <span className="eva-count">[ {urgentOverdueTasks.length}件 超過 ]</span>
                    </div>
                    <div className="eva-stripes" />
                </div>
            )}
            <header className="ux-top-header">
                <div className="ux-logo-area"><div className="ux-logo-circle"></div><div><h1>カスタマー業務スケジュール</h1><p>毎日の業務を、もっとやさしく、もっと確実に。</p></div></div>
            </header>

            <div className="ux-main-layout">
                <aside className="ux-side-nav">
                    <nav className="ux-nav-menu">
                        <div className="ux-nav-item active"><CalendarIcon size={18} /><span>カレンダー</span></div>
                        <div className="ux-nav-item"><List size={18} /><span>タスク一覧</span></div>
                        <div className="ux-nav-item"><LayoutGrid size={18} /><span>カテゴリ</span></div>
                        <div className="ux-nav-item"><CheckSquare size={18} /><span>完了履歴</span></div>
                        <div className="ux-nav-item"><Bell size={18} /><span>重要事項</span>{urgentPendingCount > 0 && <span className="ux-badge">{urgentPendingCount}</span>}</div>
                        <div className="ux-nav-item"><Settings size={18} /><span>設定</span></div>
                    </nav>
                    <div className="ux-operator-area">
                        <label>👤 今日の担当者</label>
                        <input
                            type="text"
                            className="ux-operator-input"
                            value={operatorName}
                            onChange={e => { setOperatorName(e.target.value); localStorage.setItem('schedule_operator', e.target.value); }}
                            placeholder="名前を入力..."
                        />
                    </div>
                    <div className="ux-category-filter">
                        <label>表示設定</label>
                        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                            <option value="all">すべてのカテゴリ</option>
                            <option value="customer">カスタマー</option>
                            <option value="store">店舗</option>
                            <option value="autoship">オートシップ</option>
                            <option value="billing">請求</option>
                        </select>
                        <div className="ux-cat-dots">
                            {CATEGORIES.map(c => (
                                <div key={c.id} className={`ux-dot-item ${filterCategory === c.id ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === c.id ? 'all' : c.id)} style={{ cursor: 'pointer' }}>
                                    <span className="dot" style={{ background: c.dot }}></span>
                                    <span>{c.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="ux-content-area">
                    <div className="ux-board-control">
                        <div className="ux-date-selector">
                            <span className="ux-current-year">{format(currentDate, 'yyyy年M月', { locale: ja })}</span>
                            <div className="ux-arrow-group">
                                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft size={16} /></button>
                                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight size={16} /></button>
                            </div>
                            <button className="ux-today-btn" onClick={() => setCurrentDate(new Date(2026, 3, 1))}>今日</button>
                        </div>
                        <div className="ux-view-switcher">
                            <div className="ux-switch-group">
                                <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}><CalendarIcon size={16} />月表示</button>
                                <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}><LayoutGrid size={16} />週表示</button>
                                <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}><List size={16} />リスト表示</button>
                            </div>
                            <button className="ux-add-btn" onClick={() => { setSelectedTask(null); setEditForm({...editForm, title: '', date: format(new Date(), 'yyyy-MM-dd'), category: 'customer', description: '', memo: ''}); setIsPanelOpen(true); }}>
                                <Plus size={18} /> タスクを追加
                            </button>
                        </div>
                    </div>

                    <div className="ux-calendar-grid">
                        <div className="ux-grid-header">
                            <div className="ux-week-col"></div>
                            {['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '共有メモ欄'].map(d => <div key={d} className="ux-header-cell">{d}</div>)}
                        </div>
                        <div className="ux-grid-body">
                            {weeks.map((week, wIdx) => (
                                <div key={wIdx} className="ux-week-row">
                                    <div className="ux-week-info">
                                        <span className="label">week{wIdx+1}</span>
                                        <span className="range">{format(week[0], 'M/d')}〜{format(week[4], 'M/d')}</span>
                                    </div>
                                    {week.slice(0, 5).map((day, dIdx) => {
                                        const dayTasks = filteredTasks.filter(t => isSameDay(t.date, day));
                                        const isHol = isHoliday(day);
                                        return (
                                            <div key={dIdx} className={`ux-day-cell ${!isSameMonth(day, monthStart) ? 'dimmed' : ''} ${isHol ? 'is-holiday' : ''}`} onClick={() => { setSelectedTask(null); setEditForm({...editForm, title: '', date: format(day, 'yyyy-MM-dd'), category: 'customer', description: '', memo: ''}); setIsPanelOpen(true); }}>
                                                <span className={`day-num ${isHol ? 'holiday-num' : ''}`}>{format(day, 'd')}{isHol ? ' 🎌' : ''}</span>
                                                <div className="ux-cell-tasks">
                                                    {dayTasks.map(t => (
                                                        <div key={t.id} className={`ux-task-mini ${t.completed ? 'is-done' : ''} ${t.isUrgent && !t.completed ? 'is-urgent' : ''}`} style={{ borderLeftColor: t.isUrgent && !t.completed ? '#ef4444' : CATEGORIES.find(c => c.id === t.category)?.dot }} onClick={(e) => { e.stopPropagation(); openDetails(t); }}>
                                                            <div className="mini-header"><div className="title">{t.title}</div><button className="mini-check-btn" onClick={(e) => { e.stopPropagation(); toggleTask(t.id, t.completed); }}>{t.completed ? <CheckCircle2 size={16} color="#689f38" /> : <div className="circle-placeholder"></div>}</button></div>
                                                            <div className="footer">
                                                                <span className="tag" style={{ background: CATEGORIES.find(c => c.id === t.category)?.bg, color: CATEGORIES.find(c => c.id === t.category)?.color }}>{CATEGORIES.find(c => c.id === t.category)?.label}</span>
                                                                {t.assignee && <span className="assignee-badge">👤 {t.assignee}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="ux-day-cell shared-memo-cell" onClick={e => e.stopPropagation()}>
                                        <span className="memo-col-label">📝 共有メモ</span>
                                        <textarea
                                            className="shared-memo-textarea"
                                            value={sharedMemos[format(week[0], 'yyyy-MM-dd')] || ''}
                                            onChange={(e) => handleMemoChange(format(week[0], 'yyyy-MM-dd'), e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="休暇者・連絡事項など..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                <aside className={`ux-detail-panel ${isPanelOpen ? 'is-open' : ''}`}>
                    <div className="ux-panel-header"><h3>タスク詳細</h3><button onClick={() => setIsPanelOpen(false)}><X size={20} /></button></div>
                    <div className="ux-panel-content">
                        <div className="ux-panel-cat-selector">
                            {CATEGORIES.map(cat => (
                                <button key={cat.id} type="button" 
                                        className={`ux-cat-choice ${editForm.category === cat.id ? 'active' : ''}`}
                                        style={{ '--cat-bg': cat.bg, '--cat-color': cat.color }}
                                        onClick={() => setEditForm({...editForm, category: cat.id})}>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                        <input type="text" className="ux-panel-title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} placeholder="タイトルを入力" />
                        <div className="ux-field"><label>👤 担当者</label><input type="text" className="ux-assignee-input" value={editForm.assignee} onChange={e => setEditForm({...editForm, assignee: e.target.value})} placeholder="担当者名を入力..." /></div>
                        <div className="ux-field"><label><CalendarIcon size={14} /> 予定日</label><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                        <div className="ux-field ux-urgent-field">
                            <button type="button" className={`ux-urgent-btn ${editForm.isUrgent ? 'active' : ''}`} onClick={() => setEditForm({...editForm, isUrgent: !editForm.isUrgent})}>
                                <Zap size={14} /> {editForm.isUrgent ? '🔴 重要設定中' : '重要！に設定'}
                            </button>
                            {editForm.isUrgent && (
                                <div className="ux-deadline-picker">
                                    <label>最終取組み日時</label>
                                    <input type="datetime-local" value={editForm.urgentDeadline || ''} onChange={e => setEditForm({...editForm, urgentDeadline: e.target.value})} />
                                </div>
                            )}
                        </div>
                        <div className="ux-field column"><label>詳細</label><textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></div>
                        <div className="ux-field column"><label>チェックリスト</label><div className="ux-checklist"><div className="ux-check-item"><input type="checkbox" id="check-done" checked={selectedTask?.completed || false} onChange={() => toggleTask(selectedTask.id, selectedTask.completed)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} /><label htmlFor="check-done" style={{ fontSize: '1rem', cursor: 'pointer' }}>完了にする</label></div></div></div>
                        <div className="ux-field column"><label>メモ</label><textarea value={editForm.memo} onChange={e => setEditForm({...editForm, memo: e.target.value})} className="ux-memo-area" /></div>

                        {/* リピート設定 */}
                        <div className="ux-field ux-repeat-field">
                            <label style={{ fontWeight: 800, color: '#94a3b8', fontSize: '0.85rem' }}>🔄 繰り返し設定</label>
                            <select value={editForm.repeatType} onChange={e => setEditForm({...editForm, repeatType: e.target.value, isRepeatTemplate: e.target.value !== 'none'})} className="ux-repeat-select">
                                <option value="none">繰り返しなし</option>
                                <option value="monthly_date">毎月指定日</option>
                                <option value="monthly_nth">第N曜日</option>
                                <option value="weekly">毎週指定曜日</option>
                            </select>
                            {editForm.repeatType === 'monthly_date' && (
                                <div className="ux-repeat-sub">
                                    <label>毎月</label>
                                    <input type="number" min="1" max="28" value={editForm.repeatConfig.date} onChange={e => setEditForm({...editForm, repeatConfig: {...editForm.repeatConfig, date: e.target.value}})} className="ux-repeat-num" />
                                    <label>日</label>
                                </div>
                            )}
                            {editForm.repeatType === 'monthly_nth' && (
                                <div className="ux-repeat-sub">
                                    <label>第</label>
                                    <input type="number" min="1" max="5" value={editForm.repeatConfig.nth} onChange={e => setEditForm({...editForm, repeatConfig: {...editForm.repeatConfig, nth: e.target.value}})} className="ux-repeat-num" />
                                    <select value={editForm.repeatConfig.weekday} onChange={e => setEditForm({...editForm, repeatConfig: {...editForm.repeatConfig, weekday: e.target.value}})} className="ux-repeat-select">
                                        <option value="0">日曜</option><option value="1">月曜</option><option value="2">火曜</option><option value="3">水曜</option><option value="4">木曜</option><option value="5">金曜</option>
                                    </select>
                                </div>
                            )}
                            {editForm.repeatType === 'weekly' && (
                                <div className="ux-repeat-sub">
                                    <label>毎週</label>
                                    <select value={editForm.repeatConfig.weekday} onChange={e => setEditForm({...editForm, repeatConfig: {...editForm.repeatConfig, weekday: e.target.value}})} className="ux-repeat-select">
                                        <option value="0">日曜</option><option value="1">月曜</option><option value="2">火曜</option><option value="3">水曜</option><option value="4">木曜</option><option value="5">金曜</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="ux-panel-actions"><button className="ux-save-btn" onClick={handleSave}><Save size={16} /> 保存</button>{selectedTask && <button className="ux-del-btn" onClick={handleDelete}>タスクを削除</button>}</div>
                    </div>
                </aside>
            </div>
            {!tasks.length && <button onClick={importCSVData} style={{ position: 'fixed', bottom: 20, right: 20, opacity: 0.5 }}>CSVインポート</button>}
        </div>
    );
};

export default ScheduleManagement;
