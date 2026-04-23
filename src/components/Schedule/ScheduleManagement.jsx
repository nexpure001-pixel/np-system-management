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
    isValid,
    differenceInCalendarDays,
    addDays
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
    FileUp,
    LayoutGrid,
    List,
    Settings,
    Bell,
    CheckSquare,
    Paperclip,
    ArrowRight
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

const ScheduleManagement = () => {
    const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1));
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [viewMode, setViewMode] = useState('month'); // month, week, list
    const [isImporting, setIsImporting] = useState(false);

    const [editForm, setEditForm] = useState({
        title: '', category: 'customer', date: format(new Date(), 'yyyy-MM-dd'), 
        isImportant: false, description: '', subtasks: [], memo: ''
    });

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
        });
        return () => unsubscribe();
    }, []);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // 週ごとにグループ化（完成イメージの左列 week1... 用）
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7));
    }

    const openDetails = (task) => {
        setSelectedTask(task);
        setEditForm({
            title: task.title || '',
            category: task.category || 'customer',
            date: format(task.date, 'yyyy-MM-dd'),
            isImportant: task.isImportant || false,
            description: task.description || '',
            subtasks: task.subtasks || [],
            memo: task.memo || ''
        });
        setIsPanelOpen(true);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const taskData = { ...editForm, updated_at: Timestamp.now() };
        try {
            if (selectedTask) await updateDoc(doc(db, 'schedule_tasks', selectedTask.id), taskData);
            else await addDoc(collection(db, 'schedule_tasks'), { ...taskData, completed: false, created_at: Timestamp.now() });
            setIsPanelOpen(false);
        } catch (err) { alert("保存に失敗しました"); }
    };

    const toggleTask = async (taskId, currentStatus) => {
        try {
            await updateDoc(doc(db, 'schedule_tasks', taskId), {
                completed: !currentStatus,
                completed_at: !currentStatus ? Timestamp.now() : null
            });
        } catch (err) { console.error(err); }
    };

    const handleDelete = async () => {
        if (!selectedTask || !window.confirm("このタスクを削除しますか？")) return;
        try {
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
            {/* 完成イメージの上部ヘッダー */}
            <header className="ux-top-header">
                <div className="ux-logo-area">
                    <div className="ux-logo-circle"></div>
                    <div>
                        <h1>カスタマー業務スケジュール</h1>
                        <p>毎日の業務を、もっとやさしく、もっと確実に。</p>
                    </div>
                    <div className="ux-bird-deco"></div>
                </div>
                <div className="ux-user-area">
                   <div className="ux-icon-btn"><Bell size={20} /><span className="ux-badge">3</span></div>
                   <div className="ux-user-profile">
                        <img src="https://ui-avatars.com/api/?name=田中+花子&background=E8F5E9&color=2E7D32" alt="Avatar" />
                        <div className="ux-user-info">
                            <span className="name">田中 花子</span>
                            <span className="role">管理者</span>
                        </div>
                        <ChevronLeft size={16} style={{ transform: 'rotate(-90deg)' }} />
                   </div>
                </div>
            </header>

            <div className="ux-main-layout">
                {/* イメージの左側ナビゲーション */}
                <aside className="ux-side-nav">
                    <nav className="ux-nav-menu">
                        <div className="ux-nav-item active"><CalendarIcon size={18} /><span>カレンダー</span></div>
                        <div className="ux-nav-item"><List size={18} /><span>タスク一覧</span></div>
                        <div className="ux-nav-item"><LayoutGrid size={18} /><span>カテゴリ</span></div>
                        <div className="ux-nav-item"><CheckSquare size={18} /><span>完了履歴</span></div>
                        <div className="ux-nav-item"><Bell size={18} /><span>お知らせ</span><span className="ux-badge">2</span></div>
                        <div className="ux-nav-item"><Settings size={18} /><span>設定</span></div>
                    </nav>
                    <div className="ux-category-filter">
                        <label>表示設定</label>
                        <select defaultValue="all">
                            <option value="all">すべてのカテゴリ</option>
                        </select>
                        <div className="ux-cat-dots">
                            {CATEGORIES.map(c => (
                                <div key={c.id} className="ux-dot-item">
                                    <span className="dot" style={{ background: c.dot }}></span>
                                    <span>{c.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* メインコンテンツ */}
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
                            <button className="ux-add-btn" onClick={() => { setSelectedTask(null); setIsPanelOpen(true); }}>
                                <Plus size={18} /> タスクを追加
                            </button>
                        </div>
                    </div>

                    <div className="ux-calendar-grid">
                        <div className="ux-grid-header">
                            <div className="ux-week-col"></div>
                            {['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土日（メモ）'].map(d => <div key={d} className="ux-header-cell">{d}</div>)}
                        </div>
                        <div className="ux-grid-body">
                            {weeks.map((week, wIdx) => (
                                <div key={wIdx} className="ux-week-row">
                                    <div className="ux-week-info">
                                        <span className="label">week{wIdx+1}</span>
                                        <span className="range">{format(week[0], 'M/d')}〜{format(week[4], 'M/d')}</span>
                                    </div>
                                    {week.slice(0, 5).map((day, dIdx) => {
                                        const dayTasks = tasks.filter(t => isSameDay(t.date, day));
                                        return (
                                            <div key={dIdx} className={`ux-day-cell ${!isSameMonth(day, monthStart) ? 'dimmed' : ''}`} onClick={() => { setEditForm({...editForm, date: format(day, 'yyyy-MM-dd')}); setIsPanelOpen(true); }}>
                                                <span className="day-num">{format(day, 'd')}</span>
                                                <div className="ux-cell-tasks">
                                                    {dayTasks.map(t => (
                                                        <div key={t.id} className={`ux-task-mini ${t.completed ? 'is-done' : ''}`} style={{ borderLeftColor: CATEGORIES.find(c => c.id === t.category)?.dot }} onClick={(e) => { e.stopPropagation(); openDetails(t); }}>
                                                            <div className="title">{t.title}</div>
                                                            <div className="footer">
                                                                <span className="tag" style={{ background: CATEGORIES.find(c => c.id === t.category)?.bg, color: CATEGORIES.find(c => c.id === t.category)?.color }}>{CATEGORIES.find(c => c.id === t.category)?.label}</span>
                                                                {t.completed && <CheckCircle2 size={12} className="done-icon" />}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {/* 土日まとめ列 */}
                                    <div className="ux-day-cell weekend">
                                        {tasks.filter(t => (isSameDay(t.date, week[5]) || isSameDay(t.date, week[6]))).map(t => (
                                            <div key={t.id} className="ux-task-mini weekend-memo" onClick={(e) => { e.stopPropagation(); openDetails(t); }}>
                                                {format(t.date, 'd')}日：{t.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <footer className="ux-footer">
                        © 2026 カスタマー業務スケジュール All Rights reserved.
                    </footer>
                </main>

                {/* 右側詳細パネル（イメージの「タスク詳細」） */}
                <aside className={`ux-detail-panel ${isPanelOpen ? 'is-open' : ''}`}>
                    <div className="ux-panel-header">
                        <h3>タスク詳細</h3>
                        <button onClick={() => setIsPanelOpen(false)}><X size={20} /></button>
                    </div>
                    <div className="ux-panel-content">
                        <span className="ux-panel-tag" style={{ background: CATEGORIES.find(c => c.id === editForm.category)?.bg, color: CATEGORIES.find(c => c.id === editForm.category)?.color }}>{CATEGORIES.find(c => c.id === editForm.category)?.label}</span>
                        <input type="text" className="ux-panel-title" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} placeholder="タイトルを入力" />
                        
                        <div className="ux-field">
                            <label><CalendarIcon size={14} /> 予定日</label>
                            <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                        </div>
                        
                        <div className="ux-field">
                            <label><Clock size={14} /> 繰り返し</label>
                            <span>毎月1日</span>
                        </div>

                        <div className="ux-field column">
                            <label>詳細</label>
                            <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} placeholder="詳細情報を入力..." />
                        </div>

                        <div className="ux-field column">
                            <label>チェックリスト</label>
                            <div className="ux-checklist">
                                <div className="ux-check-item">
                                    <input type="checkbox" id="check-done" checked={selectedTask?.completed} onChange={() => toggleTask(selectedTask.id, selectedTask.completed)} />
                                    <label htmlFor="check-done">完了</label>
                                </div>
                                <div className="ux-check-item plus">
                                    <Plus size={14} /> <span>メモを追加</span>
                                </div>
                            </div>
                        </div>

                        <div className="ux-field column">
                            <label>メモ</label>
                            <textarea value={editForm.memo} onChange={e => setEditForm({...editForm, memo: e.target.value})} className="ux-memo-area" />
                        </div>

                        <div className="ux-field column">
                            <label>添付ファイル</label>
                            <div className="ux-attachment-btn">
                                <Paperclip size={14} /> <span>ファイルを添付</span>
                            </div>
                        </div>

                        <div className="ux-panel-actions">
                            <button className="ux-save-btn" onClick={handleSave}><Save size={16} /> 保存</button>
                            {selectedTask && <button className="ux-del-btn" onClick={handleDelete}>タスクを削除</button>}
                        </div>
                    </div>
                    {/* イメージ下部のイラスト装飾はCSSで配置 */}
                    <div className="ux-panel-deco"></div>
                </aside>
            </div>
            {/* 一時的なインポートボタン */}
            {!tasks.length && <button onClick={importCSVData} style={{ position: 'fixed', bottom: 20, right: 20, opacity: 0.5 }}>CSVインポート</button>}
        </div>
    );
};

export default ScheduleManagement;
