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
    setMonth,
    setYear,
    setDate
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
    FileUp
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
    { id: 'customer', label: 'カスタマー', bg: '#FFEBEE', color: '#B71C1C' },
    { id: 'store', label: '店舗', bg: '#FFF3E0', color: '#E65100' },
    { id: 'autoship', label: 'オートシップ', bg: '#E8F5E9', color: '#1B5E20' },
    { id: 'billing', label: '請求', bg: '#E3F2FD', color: '#0D47A1' },
];

const ScheduleManagement = () => {
    const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // 2026年4月に初期化
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [compactCompleted, setCompactCompleted] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const [editForm, setEditForm] = useState({
        title: '', category: 'customer', date: format(new Date(), 'yyyy-MM-dd'), isImportant: false, description: '', subtasks: []
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
                if (!isValid(taskDate)) taskDate = new Date();
                return { id: doc.id, ...data, date: taskDate };
            });
            setTasks(taskList);
        });
        return () => unsubscribe();
    }, []);

    // CSVインポートロジック（2026.4月分専用）
    const importCSVData = async () => {
        setIsImporting(true);
        try {
            const response = await fetch('/schedule_202604.csv');
            const csvText = await response.text();
            const results = Papa.parse(csvText, { header: false });
            const data = results.data;

            const newTasks = [];
            let currentWeekDates = [null, null, null, null, null, null, null, null]; // [0, Mon, Tue, Wed, Thu, Fri, SatSun, SatSun]

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const firstCol = row[0] || '';

                // 週の開始行
                if (firstCol.startsWith('week')) {
                    currentWeekDates = [null]; // リセット
                    for (let c = 1; c <= 6; c++) {
                        const dayVal = row[c]?.trim();
                        if (dayVal && !isNaN(dayVal)) {
                            currentWeekDates[c] = parseInt(dayVal);
                        } else {
                            currentWeekDates[c] = null;
                        }
                    }
                    continue;
                }

                // カテゴリー行の処理
                const categoryMap = { 'カスタマー': 'customer', '店舗': 'store', 'オートシップ': 'autoship', '請求': 'billing' };
                if (categoryMap[firstCol]) {
                    const categoryId = categoryMap[firstCol];
                    for (let c = 1; c <= 6; c++) {
                        const dayDate = currentWeekDates[c];
                        const taskText = row[c]?.trim();
                        if (dayDate && taskText) {
                            const dateObj = new Date(2026, 3, dayDate);
                            newTasks.push({
                                title: taskText.split('\n')[0], // 1行目をタイトルに
                                description: taskText,
                                category: categoryId,
                                date: format(dateObj, 'yyyy-MM-dd'),
                                completed: false,
                                isImportant: taskText.includes('⚠️') || taskText.includes('【〆切】'),
                                created_at: Timestamp.now()
                            });
                        }
                    }
                }
            }

            // Firestoreへ保存
            for (const t of newTasks) {
                await addDoc(collection(db, 'schedule_tasks'), t);
            }
            alert(`${newTasks.length}件の予定を取り込みました。`);
        } catch (err) {
            console.error(err);
            alert("インポートに失敗しました。");
        }
        setIsImporting(false);
    };

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const openEditor = (task = null, defaultDate = null) => {
        if (task) {
            setSelectedTask(task);
            setEditForm({
                title: task.title || '', category: task.category || 'customer', date: format(task.date, 'yyyy-MM-dd'),
                isImportant: task.isImportant || false, description: task.description || '', subtasks: task.subtasks || []
            });
        } else {
            setSelectedTask(null);
            setEditForm({
                title: '', category: 'customer', date: defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                isImportant: false, description: '', subtasks: []
            });
        }
        setIsPanelOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
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

    return (
        <div className="schedule-container">
            <div className="schedule-board-frame">
                <header className="schedule-header">
                    <div className="header-left">
                        <h1>業務進捗ボード</h1>
                        <div className="month-control">
                            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="icon-btn"><ChevronLeft size={16} /></button>
                            <h2>{format(currentDate, 'yyyy年 M月', { locale: ja })}</h2>
                            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="icon-btn"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="header-right">
                        <button className="glass-btn secondary" onClick={importCSVData} disabled={isImporting}>
                            <FileUp size={16} /> {isImporting ? '読込中...' : 'CSV読込(2026.4)'}
                        </button>
                        <button className={`icon-btn ${compactCompleted ? 'active' : ''}`} onClick={() => setCompactCompleted(!compactCompleted)}>
                            {compactCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <div className="task-count">
                            <Clock size={14} />
                            <span>未完了: {tasks.filter(t => !t.completed).length}件</span>
                        </div>
                        <button className="glass-btn primary" onClick={() => openEditor()}>
                            <Plus size={18} /> 新規業務
                        </button>
                    </div>
                </header>

                <div className="calendar-grid">
                    <div className="weekdays">
                        {['月', '火', '水', '木', '金', '土', '日'].map(day => <div key={day} className="weekday">{day}</div>)}
                    </div>
                    <div className="days">
                        {calendarDays.map((day, idx) => {
                            const dayTasks = tasks.filter(task => isSameDay(task.date, day));
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            return (
                                <div key={idx} className={`day-cell ${!isCurrentMonth ? 'outside' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
                                     onClick={() => openEditor(null, day)}>
                                    <div className="day-number">{format(day, 'd')}</div>
                                    <div className="day-tasks">
                                        {dayTasks.map(task => (
                                            <div key={task.id} 
                                                 className={`task-card ${task.completed ? 'completed' : ''} ${compactCompleted && task.completed ? 'compact' : ''}`}
                                                 style={{ backgroundColor: task.completed ? '' : (CATEGORIES.find(c => c.id === task.category)?.bg || '#eee') }}
                                                 onClick={(e) => { e.stopPropagation(); if (!(compactCompleted && task.completed)) openEditor(task); }}>
                                                <div className="task-main">
                                                    <button className="check-btn" onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.completed); }}>
                                                        {task.completed ? <CheckCircle2 size={13} color="#689f38" /> : <Circle size={13} />}
                                                    </button>
                                                    <span className={`task-title ${task.isImportant ? 'important' : ''}`}>{task.title}</span>
                                                </div>
                                                {task.isImportant && !task.completed && <AlertCircle size={10} className="important-icon" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            {/* 詳細エディタ（サイドパネル）は維持 */}
            <div className={`side-panel-overlay ${isPanelOpen ? 'open' : ''}`} onClick={() => setIsPanelOpen(false)}>
                <div className="side-panel" onClick={e => e.stopPropagation()}>
                    <div className="side-header">
                        <div className="header-title"><CalendarIcon size={20} /><h3>{selectedTask ? '業務詳細' : '新規登録'}</h3></div>
                        <button onClick={() => setIsPanelOpen(false)} className="close-btn"><X size={24} /></button>
                    </div>
                    <form onSubmit={handleSave} className="editor-form">
                        <section className="form-section"><label>タイトル</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} required className="main-input" /></section>
                        <section className="form-section"><label>カテゴリー</label><div className="category-selector">{CATEGORIES.map(cat => (<button key={cat.id} type="button" className={`cat-btn ${editForm.category === cat.id ? 'active' : ''}`} style={{ '--cat-bg': cat.bg, '--cat-color': cat.color }} onClick={() => setEditForm({...editForm, category: cat.id})}>{cat.label}</button>))}</div></section>
                        <div className="form-row"><section className="form-section flex-1"><label>予定日</label><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} required /></section><section className="form-section"><label>重要度</label><button type="button" className={`important-toggle ${editForm.isImportant ? 'active' : ''}`} onClick={() => setEditForm({...editForm, isImportant: !editForm.isImportant})}><AlertTriangle size={18} /><span>重要設定</span></button></section></div>
                        <section className="form-section"><label>詳細</label><textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></section>
                        <div className="editor-actions">{selectedTask && (<button type="button" className="delete-btn" onClick={handleDelete}><Trash2 size={18} /> 削除</button>)}<button type="submit" className="save-btn"><Save size={18} /> 保存</button></div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ScheduleManagement;
