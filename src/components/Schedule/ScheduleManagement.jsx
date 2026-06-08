import { useState, useEffect, useRef } from 'react';
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
    Timestamp,
    limit,
    getDocs,
    where
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

const isHoliday = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return false;
    return HOLIDAYS_2026.has(format(new Date(date), 'yyyy-MM-dd'));
};

const getNextBusinessDay = (date) => {
    let current = new Date(date);
    while (isHoliday(current) || current.getDay() === 0 || current.getDay() === 6) {
        current.setDate(current.getDate() + 1);
    }
    return current;
};

const ScheduleManagement = ({ jumpTask, onJumpComplete }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
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

    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

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
                else setSelectedTask(null); // 削除等でリストから消えた場合はクリア
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

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const q = query(collection(db, 'task_logs'), orderBy('operated_at', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLogModalOpen(true);
        } catch (err) {
            console.error(err);
            alert("ログの取得に失敗しました");
        } finally {
            setIsLoadingLogs(false);
        }
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

    const checkedTemplatesRef = useRef(new Set());

    // 自動リピート生成（カレンダーの表示月が変わったとき、またはタスク読み込み時）
    useEffect(() => {
        if (!tasks.length || !currentDate || isNaN(currentDate.getTime())) return;
        
        // カレンダーで「現在表示している月」を基準に生成する
        const yearMonth = format(currentDate, 'yyyy-MM');
        const templates = tasks.filter(t => t.isRepeatTemplate && t.repeatType !== 'none');
        
        templates.forEach(async (tmpl) => {
            const checkKey = `${tmpl.id}-${yearMonth}`;
            // このセッションで既にこのテンプレートのこの月の生成処理をチェック済みならスキップ（無限増殖防止）
            if (checkedTemplatesRef.current.has(checkKey)) return;
            checkedTemplatesRef.current.add(checkKey);

            // 当月分がすでに生成済みかDBデータで確実にチェック
            const q = query(
                collection(db, 'schedule_tasks'), 
                where('generatedFromTemplate', '==', tmpl.id), 
                where('generatedFor', '==', yearMonth)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return;

            let targetDates = [];
            const y = currentDate.getFullYear(), m = currentDate.getMonth();
            if (tmpl.repeatType === 'monthly_date') {
                const parsedDate = parseInt(tmpl.repeatConfig?.date);
                const d = isNaN(parsedDate) ? 1 : parsedDate;
                targetDates.push(new Date(y, m, d));
            } else if (tmpl.repeatType === 'weekly') {
                // 対象曜日をその月すべて生成
                const parsedWd = parseInt(tmpl.repeatConfig?.weekday);
                const wd = isNaN(parsedWd) ? 1 : parsedWd;
                const first = new Date(y, m, 1);
                const diff = (wd - first.getDay() + 7) % 7;
                let current = new Date(y, m, 1 + diff);
                while (current.getMonth() === m) {
                    targetDates.push(new Date(current));
                    current.setDate(current.getDate() + 7);
                }
            } else if (tmpl.repeatType === 'monthly_nth') {
                // 第N曜日
                const parsedWd = parseInt(tmpl.repeatConfig?.weekday);
                const wd = isNaN(parsedWd) ? 1 : parsedWd;
                const parsedNth = parseInt(tmpl.repeatConfig?.nth);
                const nth = isNaN(parsedNth) ? 1 : parsedNth;
                const first = new Date(y, m, 1);
                const diff = (wd - first.getDay() + 7) % 7;
                targetDates.push(new Date(y, m, 1 + diff + (nth - 1) * 7));
            }
            
            // 有効な日付のみにフィルター
            targetDates = targetDates.filter(d => d && !isNaN(d.getTime()));
            if (!targetDates.length) return;

            targetDates.forEach(async (tDate) => {
                const finalDate = getNextBusinessDay(tDate);
                if (!finalDate || isNaN(finalDate.getTime())) return;
                await addDoc(collection(db, 'schedule_tasks'), {
                    title: tmpl.title,
                    category: tmpl.category,
                    description: tmpl.description || '',
                    memo: tmpl.memo || '',
                    date: format(finalDate, 'yyyy-MM-dd'),
                    completed: false,
                    isImportant: tmpl.isImportant || false,
                    isUrgent: false,
                    assignee: tmpl.assignee || '',
                    subtasks: tmpl.subtasks || [],
                    generatedFromTemplate: tmpl.id,
                    generatedFor: yearMonth,
                    created_at: Timestamp.now()
                });
            });
        });
    }, [tasks.length, currentDate]);

    try {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) weeks.push(calendarDays.slice(i, i + 7));

    const now = new Date();

    const filteredTasks = tasks.filter(t => {
        if (filterCategory === 'all') return true;
        if (filterCategory === 'urgent') return t.isUrgent && !t.isRepeatTemplate;
        return t.category === filterCategory;
    });

    // 緊急アラート・バッジ用
    const urgentOverdueTasks = tasks.filter(t => !t.isRepeatTemplate && t.isUrgent && !t.completed && t.urgentDeadline && new Date(t.urgentDeadline) < now);
    const urgentPendingCount = tasks.filter(t => !t.isRepeatTemplate && t.isUrgent && !t.completed && t.urgentDeadline && new Date(t.urgentDeadline) <= now).length;

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

    useEffect(() => {
        if (jumpTask) {
            // タスクの日付の月にカレンダーを移動
            if (jumpTask.date) {
                setCurrentDate(new Date(jumpTask.date));
            }
            // 表示設定を「重要事項」に変更して見つけやすくする
            setFilterCategory('urgent');
            // 詳細パネルを開く
            openDetails(jumpTask);
            // ジャンプ処理完了を親に通知
            if (onJumpComplete) onJumpComplete();
        }
    }, [jumpTask]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        
        // 繰り返しグループの判定
        const isRepeat = selectedTask && (selectedTask.isRepeatTemplate || selectedTask.generatedFromTemplate);
        const templateId = isRepeat ? (selectedTask.isRepeatTemplate ? selectedTask.id : selectedTask.generatedFromTemplate) : null;

        try {
            if (selectedTask) {
                if (isRepeat && templateId) {
                    // --- 繰り返しタスクグループの更新 ---
                    const baseTask = tasks.find(t => t.id === templateId);
                    if (!baseTask) {
                        alert("大元のテンプレートが見つかりません。");
                        return;
                    }

                    // 1. 予定日（date）の変更検知と、repeatConfig の逆算
                    let updatedRepeatConfig = { ...editForm.repeatConfig };
                    const originalDateStr = format(selectedTask.date, 'yyyy-MM-dd');
                    const isDateChanged = editForm.date !== originalDateStr;

                    if (isDateChanged && editForm.repeatType !== 'none') {
                        const newDateObj = new Date(editForm.date);
                        const day = newDateObj.getDay();
                        // 土日の場合は平日に丸める (0:日曜, 6:土曜)
                        const weekday = day === 0 ? 1 : (day === 6 ? 5 : day);
                        
                        if (editForm.repeatType === 'weekly') {
                            updatedRepeatConfig.weekday = weekday;
                        } else if (editForm.repeatType === 'monthly_date') {
                            updatedRepeatConfig.date = Math.min(28, Math.max(1, newDateObj.getDate()));
                        } else if (editForm.repeatType === 'monthly_nth') {
                            updatedRepeatConfig.weekday = weekday;
                            updatedRepeatConfig.nth = Math.min(5, Math.ceil(newDateObj.getDate() / 7));
                        }
                    }

                    // 2. 大元（テンプレート）を更新
                    const templateUpdateData = {
                        title: editForm.title,
                        category: editForm.category,
                        description: editForm.description || '',
                        memo: editForm.memo || '',
                        isImportant: editForm.isImportant || false,
                        isUrgent: editForm.isUrgent || false,
                        urgentDeadline: editForm.isUrgent ? (editForm.urgentDeadline || '') : '',
                        assignee: editForm.assignee || '',
                        repeatType: editForm.repeatType,
                        repeatConfig: updatedRepeatConfig,
                        isRepeatTemplate: editForm.repeatType !== 'none',
                        date: editForm.date, // 基準予定日も更新
                        updated_at: Timestamp.now()
                    };

                    await updateDoc(doc(db, 'schedule_tasks', templateId), templateUpdateData);
                    await logAction(templateId, 'テンプレート更新', { title: baseTask.title }, { title: editForm.title });

                    // 3. 連動スケジュール（自動生成されたタスク）の同期処理
                    const generatedInstances = tasks.filter(t => t.generatedFromTemplate === templateId);
                    
                    const isRepeatRuleChanged = editForm.repeatType !== baseTask.repeatType || 
                        JSON.stringify(updatedRepeatConfig) !== JSON.stringify(baseTask.repeatConfig) ||
                        isDateChanged;

                    if (isRepeatRuleChanged) {
                        // 予定日やリピート条件が変更された場合、未完了のタスクを削除し再生成
                        const incompleteInstances = generatedInstances.filter(t => !t.completed);
                        for (const inst of incompleteInstances) {
                            await deleteDoc(doc(db, 'schedule_tasks', inst.id));
                        }

                        // すでに生成されていた月の特定、およびカレンダー表示中の月を含める
                        const uniqueMonths = [...new Set(generatedInstances.map(t => t.generatedFor).filter(Boolean))];
                        const currentYM = format(currentDate, 'yyyy-MM');
                        if (!uniqueMonths.includes(currentYM)) {
                            uniqueMonths.push(currentYM);
                        }

                        // 各月について再生成
                        for (const ym of uniqueMonths) {
                            // キャッシュクリア
                            const cacheKey = `${templateId}-${ym}`;
                            checkedTemplatesRef.current.delete(cacheKey);

                            const [yearStr, monthStr] = ym.split('-');
                            const y = parseInt(yearStr), m = parseInt(monthStr) - 1;
                            let targetDates = [];

                            if (editForm.repeatType === 'monthly_date') {
                                const parsedDate = parseInt(updatedRepeatConfig?.date);
                                const d = isNaN(parsedDate) ? 1 : parsedDate;
                                targetDates.push(new Date(y, m, d));
                            } else if (editForm.repeatType === 'weekly') {
                                const parsedWd = parseInt(updatedRepeatConfig?.weekday);
                                const wd = isNaN(parsedWd) ? 1 : parsedWd;
                                const first = new Date(y, m, 1);
                                const diff = (wd - first.getDay() + 7) % 7;
                                let current = new Date(y, m, 1 + diff);
                                while (current.getMonth() === m) {
                                    targetDates.push(new Date(current));
                                    current.setDate(current.getDate() + 7);
                                }
                            } else if (editForm.repeatType === 'monthly_nth') {
                                const parsedWd = parseInt(updatedRepeatConfig?.weekday);
                                const wd = isNaN(parsedWd) ? 1 : parsedWd;
                                const parsedNth = parseInt(updatedRepeatConfig?.nth);
                                const nth = isNaN(parsedNth) ? 1 : parsedNth;
                                const first = new Date(y, m, 1);
                                const diff = (wd - first.getDay() + 7) % 7;
                                targetDates.push(new Date(y, m, 1 + diff + (nth - 1) * 7));
                            }

                            // 有効な日付のみにフィルター
                            targetDates = targetDates.filter(d => d && !isNaN(d.getTime()));

                            for (const tDate of targetDates) {
                                const finalDate = getNextBusinessDay(tDate);
                                if (!finalDate || isNaN(finalDate.getTime())) continue;
                                await addDoc(collection(db, 'schedule_tasks'), {
                                    title: editForm.title,
                                    category: editForm.category,
                                    description: editForm.description || '',
                                    memo: editForm.memo || '',
                                    date: format(finalDate, 'yyyy-MM-dd'),
                                    completed: false,
                                    isImportant: editForm.isImportant || false,
                                    isUrgent: false,
                                    assignee: editForm.assignee || '',
                                    subtasks: editForm.subtasks || [],
                                    generatedFromTemplate: templateId,
                                    generatedFor: ym,
                                    created_at: Timestamp.now()
                                });
                            }
                        }
                    } else {
                        // ルール変更がない場合は基本情報のみを全未完了タスクに同期
                        const incompleteInstances = generatedInstances.filter(t => !t.completed);
                        for (const inst of incompleteInstances) {
                            await updateDoc(doc(db, 'schedule_tasks', inst.id), {
                                title: editForm.title,
                                category: editForm.category,
                                description: editForm.description || '',
                                memo: editForm.memo || '',
                                assignee: editForm.assignee || '',
                                isImportant: editForm.isImportant || false,
                                isUrgent: editForm.isUrgent || false,
                                urgentDeadline: editForm.isUrgent ? (editForm.urgentDeadline || '') : '',
                                updated_at: Timestamp.now()
                            });
                        }
                    }

                    // 4. 連動タスク自身の個別更新 (ルール変更がなく、selectedTaskが連動タスクの場合)
                    if (!selectedTask.isRepeatTemplate && !isRepeatRuleChanged) {
                        await updateDoc(doc(db, 'schedule_tasks', selectedTask.id), {
                            title: editForm.title,
                            category: editForm.category,
                            description: editForm.description || '',
                            memo: editForm.memo || '',
                            assignee: editForm.assignee || '',
                            isImportant: editForm.isImportant || false,
                            isUrgent: editForm.isUrgent || false,
                            urgentDeadline: editForm.isUrgent ? (editForm.urgentDeadline || '') : '',
                            date: editForm.date,
                            updated_at: Timestamp.now()
                        });
                    }

                } else {
                    // 通常の単一タスクの更新
                    await updateDoc(doc(db, 'schedule_tasks', selectedTask.id), {
                        ...editForm,
                        updated_at: Timestamp.now()
                    });
                    await logAction(selectedTask.id, 'タスク更新', { title: selectedTask.title }, { title: editForm.title });
                }
            } else {
                // 新規作成
                const taskData = { ...editForm, updated_at: Timestamp.now() };
                const ref = await addDoc(collection(db, 'schedule_tasks'), { ...taskData, completed: false, created_at: Timestamp.now() });
                await logAction(ref.id, 'タスク作成', null, { title: editForm.title });
            }
            setSelectedTask(null);
            setIsPanelOpen(false);
        } catch (err) {
            console.error(err);
            alert("保存に失敗しました");
        }
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
        if (!selectedTask) return;
        
        const isRepeat = selectedTask.isRepeatTemplate || selectedTask.generatedFromTemplate;
        const templateId = isRepeat ? (selectedTask.isRepeatTemplate ? selectedTask.id : selectedTask.generatedFromTemplate) : null;
        
        let message = "このタスクを削除しますか？";
        if (isRepeat) {
            message = "このタスクは繰り返し設定の一部です。削除すると、大元の設定および自動生成された紐づくスケジュールもすべて一括で削除されますがよろしいですか？";
        }
        
        if (!window.confirm(message)) return;
        
        try { 
            await logAction(selectedTask.id, '削除', { title: selectedTask.title }, null);
            
            if (isRepeat && templateId) {
                // 大元の削除
                await deleteDoc(doc(db, 'schedule_tasks', templateId));
                
                // 紐づくすべてのタスクを一括削除
                const generatedInstances = tasks.filter(t => t.generatedFromTemplate === templateId);
                for (const instance of generatedInstances) {
                    await deleteDoc(doc(db, 'schedule_tasks', instance.id));
                }
            } else {
                // 通常タスクの削除
                await deleteDoc(doc(db, 'schedule_tasks', selectedTask.id)); 
            }
            setSelectedTask(null); // 選択状態をクリア
            setIsPanelOpen(false); 
        } catch (err) { 
            console.error(err);
            alert("削除に失敗しました");
        }
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
            <header className="ux-top-header">
                <div className="ux-logo-area"><div className="ux-logo-circle"></div><div><h1>カスタマー業務スケジュール</h1><p>毎日の業務を、もっとやさしく、もっと確実に。</p></div></div>
            </header>

            <div className="ux-main-layout">
                <aside className="ux-side-nav">
                    <nav className="ux-nav-menu">
                        <div className="ux-nav-item active"><CalendarIcon size={18} /><span>カレンダー</span></div>
                        <div className="ux-nav-item" onClick={fetchLogs} style={{ cursor: 'pointer' }}><CheckSquare size={18} /><span>操作ログ</span></div>
                        <div className={`ux-nav-item ${filterCategory === 'urgent' ? 'active' : ''}`} onClick={() => setFilterCategory(filterCategory === 'urgent' ? 'all' : 'urgent')} style={{ cursor: 'pointer' }}><Bell size={18} /><span>重要事項</span>{urgentPendingCount > 0 && <span className="ux-badge">{urgentPendingCount}</span>}</div>
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
                            <button className="ux-today-btn" onClick={() => setCurrentDate(new Date())}>今日</button>
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
                                        // テンプレート自体（isRepeatTemplate: true）はカレンダーから隠す
                                        const dayTasks = filteredTasks.filter(t => {
                                            if (!t.date || isNaN(new Date(t.date).getTime())) return false;
                                            return isSameDay(t.date, day) && !t.isRepeatTemplate;
                                        });
                                        const isHol = isHoliday(day) || day.getDay() === 0 || day.getDay() === 6;
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

                        {selectedTask?.generatedFromTemplate && (
                            <div className="ux-field" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 4px 0' }}>💡 これは自動生成されたタスクです</p>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>リピートの曜日や日付を変更したい場合は、大元の設定（テンプレート）を編集してください。</p>
                                </div>
                                <button type="button" onClick={() => {
                                    const tmpl = tasks.find(t => t.id === selectedTask.generatedFromTemplate);
                                    if (tmpl) openDetails(tmpl);
                                    else alert('大元の設定が見つかりません（すでに削除された可能性があります）');
                                }} style={{ background: '#319795', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    大元の設定を編集
                                </button>
                            </div>
                        )}

                        {/* リピート設定 */}
                        <div className="ux-field ux-repeat-field" style={{ display: selectedTask?.generatedFromTemplate ? 'none' : 'flex' }}>
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
                                        <option value="1">月曜</option><option value="2">火曜</option><option value="3">水曜</option><option value="4">木曜</option><option value="5">金曜</option>
                                    </select>
                                </div>
                            )}
                            {editForm.repeatType === 'weekly' && (
                                <div className="ux-repeat-sub">
                                    <label>毎週</label>
                                    <select value={editForm.repeatConfig.weekday} onChange={e => setEditForm({...editForm, repeatConfig: {...editForm.repeatConfig, weekday: e.target.value}})} className="ux-repeat-select">
                                        <option value="1">月曜</option><option value="2">火曜</option><option value="3">水曜</option><option value="4">木曜</option><option value="5">金曜</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="ux-panel-actions"><button className="ux-save-btn" onClick={handleSave}><Save size={16} /> 保存</button>{selectedTask && <button className="ux-del-btn" onClick={handleDelete}>タスクを削除</button>}</div>
                    </div>
                </aside>
            </div>
            {!tasks.length && <button onClick={importCSVData} style={{ position: 'fixed', bottom: 20, right: 20, opacity: 0.5 }}>CSVインポート</button>}

            {/* 操作ログモーダル */}
            {isLogModalOpen && (
                <div className="ux-modal-overlay">
                    <div className="ux-log-modal">
                        <div className="ux-log-modal-header">
                            <h2>📜 操作ログ (直近100件)</h2>
                            <button className="ux-close-btn" onClick={() => setIsLogModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="ux-log-modal-content">
                            {isLoadingLogs ? (
                                <div className="ux-loading-spinner">読み込み中...</div>
                            ) : (
                                <table className="ux-log-table">
                                    <thead>
                                        <tr>
                                            <th>日時</th>
                                            <th>操作者</th>
                                            <th>操作内容</th>
                                            <th>タスク名</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id}>
                                                <td>{log.operated_at ? format(log.operated_at.toDate(), 'yyyy/MM/dd HH:mm') : ''}</td>
                                                <td>{log.operator || '不明'}</td>
                                                <td>
                                                    <span className={`ux-log-badge action-${log.action === 'タスク作成' ? 'create' : log.action === 'タスク更新' ? 'update' : log.action === '完了' ? 'complete' : log.action === '削除' ? 'delete' : 'other'}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td>{log.after?.title || log.before?.title || '不明'}</td>
                                            </tr>
                                        ))}
                                        {logs.length === 0 && (
                                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>ログがありません</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
    } catch (renderError) {
        console.error("Render Error in ScheduleManagement:", renderError);
        return (
            <div style={{ padding: '24px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '12px', margin: '24px', fontFamily: 'monospace', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>⚠️ 画面の描画中にエラーが発生しました</h2>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem' }}><strong>エラーメッセージ:</strong> {renderError.message}</p>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>スタックトレース:</p>
                <pre style={{ background: '#fff', padding: '16px', border: '1px solid #fed7d7', borderRadius: '6px', overflow: 'auto', maxHeight: '350px', fontSize: '0.8rem', lineHeight: '1.4', color: '#4a5568' }}>
                    {renderError.stack}
                </pre>
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                    <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#c53030', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        画面を再読み込み
                    </button>
                    <button onClick={() => {
                        const errText = `Message: ${renderError.message}\nStack: ${renderError.stack}`;
                        navigator.clipboard.writeText(errText).then(() => alert('エラーログをコピーしました。AIに貼り付けてください。'));
                    }} style={{ padding: '8px 16px', background: '#4a5568', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        📋 エラーログをコピー
                    </button>
                </div>
            </div>
        );
    }
};

export default ScheduleManagement;
