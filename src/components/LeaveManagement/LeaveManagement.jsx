import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    Users,
    ChevronRight,
    Plus,
    Clock,
    UserPlus,
    Trash2
} from 'lucide-react';
import { format, addDays, isAfter, isBefore, parseISO, addMonths } from 'date-fns';
import { calculateGrantDays } from '../../utils/leaveCalculator';

const Card = ({ title, children, icon: Icon }) => (
    <div className="bg-white/80 backdrop-blur-md p-8 rounded-lg shadow-sm border border-white/50 space-y-6">
        <div className="flex items-center gap-2 mb-2">
            {Icon && <Icon className="w-5 h-5 text-teal-600" />}
            <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        {children}
    </div>
);

const LeaveManagement = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        upcomingGrants: [],
        expiringGrants: [],
        employeeStats: []
    });
    const [view, setView] = useState('dashboard'); // 'dashboard', 'employees', or 'detail'
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userDetail, setUserDetail] = useState({
        user: null,
        grants: [],
        requests: []
    });

    const fetchStats = async () => {
        setLoading(true);
        try {
            const today = new Date();
            const nextMonth = addDays(today, 30);

            // 1. Fetch Users
            const { data: users, error: userError } = await supabase
                .from('users')
                .select('id, full_name, joined_at');

            console.log('Fetched users:', users);
            if (userError) console.error('User fetch error:', userError);

            if (userError) throw userError;

            // 2. Fetch Active Grants
            const { data: grants, error: grantError } = await supabase
                .from('leave_grants')
                .select('*, users(full_name)')
                .gte('expiry_date', format(today, 'yyyy-MM-dd'));

            console.log('Fetched grants:', grants);
            if (grantError) console.error('Grant fetch error:', grantError);

            if (grantError) throw grantError;

            // --- Logic: Upcoming Grants ---
            const upcoming = [];
            if (users) {
                users.forEach(user => {
                    if (!user.joined_at) return;
                    const joined = new Date(user.joined_at);
                    const milestones = [6, 18, 30, 42, 54, 66];

                    milestones.forEach(m => {
                        const date = addMonths(joined, m);
                        if (isAfter(date, today) && isBefore(date, nextMonth)) {
                            upcoming.push({
                                name: user.full_name,
                                date: format(date, 'yyyy-MM-dd'),
                                days: calculateGrantDays(joined, date)
                            });
                        }
                    });
                });
            }

            // --- Logic: Expiring Soon ---
            const expiring = grants?.filter(g => {
                const expiry = parseISO(g.expiry_date);
                const remaining = g.days_granted - g.days_used;
                return isAfter(expiry, today) && isBefore(expiry, nextMonth) && remaining > 0;
            }).map(g => ({
                name: g.users?.full_name || '不明',
                date: g.expiry_date,
                remaining: g.days_granted - g.days_used
            })) || [];

            // --- Logic: All Employee Stats ---
            const empStats = users?.map(user => {
                const userGrants = grants?.filter(g => g.user_id === user.id) || [];
                let totalGranted = 0;
                let totalUsed = 0;
                let totalRemaining = 0;

                userGrants.forEach(g => {
                    if (!isBefore(parseISO(g.expiry_date), today)) {
                        totalGranted += Number(g.days_granted);
                        totalUsed += Number(g.days_used);
                        totalRemaining += (Number(g.days_granted) - Number(g.days_used));
                    }
                });

                const usageRate = totalGranted > 0 ? ((totalUsed / totalGranted) * 100).toFixed(1) : "0.0";

                return {
                    id: user.id,
                    name: user.full_name,
                    totalGranted,
                    totalUsed,
                    totalRemaining,
                    usageRate
                };
            }) || [];

            setStats({
                upcomingGrants: upcoming,
                expiringGrants: expiring,
                employeeStats: empStats
            });
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetail = async (userId) => {
        setLoading(true);
        try {
            const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
            if (userError) throw userError;

            const { data: grants, error: grantError } = await supabase.from('leave_grants').select('*').eq('user_id', userId).order('expiry_date', { ascending: true });
            if (grantError) throw grantError;

            const { data: requests, error: reqError } = await supabase.from('leave_requests').select('*, leave_consumptions(*)').eq('user_id', userId).order('date_requested', { ascending: false });
            if (reqError) throw reqError;

            setUserDetail({ user, grants: grants || [], requests: requests || [] });
            setView('detail');
            setSelectedUserId(userId);
        } catch (err) {
            console.error('Fetch user detail error:', err);
            alert('取得失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleConsumeLeave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const date = formData.get('date');
        const amount = parseFloat(formData.get('amount'));
        const reason = formData.get('reason');
        if (!date || isNaN(amount)) return;
        setLoading(true);
        try {
            const { data: req, error: reqError } = await supabase.from('leave_requests').insert([{ user_id: selectedUserId, date_requested: date, amount_days: amount, reason, status: 'pending' }]).select().single();
            if (reqError) throw reqError;
            const { error: processError } = await supabase.rpc('approve_leave_request', { target_request_id: req.id });
            if (processError) throw processError;
            alert('完了');
            fetchUserDetail(selectedUserId);
            fetchStats();
        } catch (err) {
            console.error('Consume error:', err);
            alert('失敗: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelLeave = async (requestId) => {
        if (!window.confirm('この有給予定をキャンセルしてよろしいですか？\n※残日数が元に戻ります。')) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc('cancel_leave_request', { target_request_id: requestId });
            if (error) throw error;
            
            alert('キャンセルが完了しました。');
            fetchUserDetail(selectedUserId);
            fetchStats();
        } catch (err) {
            console.error('Cancel error:', err);
            alert('キャンセルの実行に失敗しました。SQL関数が登録されているか確認してください。\n詳細: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleManualGrant = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const days = parseFloat(formData.get('days'));
        const expiryDate = formData.get('expiry_date');
        const reason = formData.get('reason');

        if (isNaN(days) || !expiryDate) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('leave_grants')
                .insert([{
                    user_id: selectedUserId,
                    days_granted: days,
                    days_used: 0,
                    valid_from: format(new Date(), 'yyyy-MM-dd'),
                    expiry_date: expiryDate,
                    reason: reason || '手動付与'
                }]);

            if (error) throw error;

            alert('付与が完了しました');
            fetchUserDetail(selectedUserId);
            fetchStats();
            e.target.reset();
        } catch (err) {
            console.error('Grant error:', err);
            alert('付与に失敗しました: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500">データを読み込み中...</div>;
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <header className="flex justify-between items-center bg-white/30 backdrop-blur-lg p-8 rounded-lg border border-white/20 shadow-xl">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                        有給管理システム
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">社員の有給休暇の管理と付与・消滅の追跡</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className={`px-6 py-3 rounded-md font-bold transition-all duration-300 ${view === 'dashboard' ? 'bg-teal-600 text-white shadow-lg shadow-teal-200 scale-105' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                    >
                        ダッシュボード
                    </button>
                    <button
                        onClick={() => setView('employees')}
                        className={`px-6 py-3 rounded-md font-bold transition-all duration-300 ${view === 'employees' ? 'bg-teal-600 text-white shadow-lg shadow-teal-200 scale-105' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                    >
                        社員一覧
                    </button>
                </div>
            </header>

            {view === 'dashboard' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <Card title="有給消滅アラート (30日以内)" icon={AlertCircle}>
                        <div className="space-y-4">
                            {stats.expiringGrants.length === 0 ? (
                                <div className="flex items-center text-gray-400 py-6 justify-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                    <CheckCircle className="w-5 h-5 mr-3 text-emerald-500" />
                                    <span>直近で消滅する有給はありません</span>
                                </div>
                            ) : (
                                stats.expiringGrants.map((item, i) => (
                                    <div key={i} className="group p-5 bg-white rounded-md border border-gray-100 hover:border-red-200 hover:shadow-md transition-all flex justify-between items-center">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mr-4 text-red-500">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{item.name}</p>
                                                <p className="text-xs text-gray-400">期限: {item.date}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-red-600 bg-red-50 px-3 py-1 rounded-full">
                                            残り {item.remaining}日
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card title="自動付与予定 (30日以内)" icon={Calendar}>
                        <div className="space-y-4">
                            {stats.upcomingGrants.length === 0 ? (
                                <div className="flex items-center text-gray-400 py-6 justify-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                    <Calendar className="w-5 h-5 mr-3" />
                                    <span>直近の付与予定はありません</span>
                                </div>
                            ) : (
                                stats.upcomingGrants.map((item, i) => (
                                    <div key={i} className="group p-5 bg-white rounded-md border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex justify-between items-center">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mr-4 text-blue-500">
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{item.name}</p>
                                                <p className="text-xs text-gray-400">予定日: {item.date}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                            +{item.days}日
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card title="全社員 有給消化状況" icon={Users}>
                        <div className="overflow-hidden rounded-lg border border-gray-100">
                            <table className="min-w-full divide-y divide-gray-100">
                                <thead className="bg-gray-50/80">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">氏名</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">残日数</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">消化率</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-50">
                                    {stats.employeeStats.map((stat) => (
                                        <tr key={stat.id} className="hover:bg-teal-50/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                {stat.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-teal-600">
                                                {stat.totalRemaining}日
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end">
                                                    <span className={`mr-2 text-xs font-bold ${parseFloat(stat.usageRate) >= 50 ? 'text-emerald-600' : 'text-orange-500'}`}>
                                                        {stat.usageRate}%
                                                    </span>
                                                    <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-1.5 rounded-full ${parseFloat(stat.usageRate) >= 50 ? 'bg-emerald-500' : 'bg-orange-400'}`}
                                                            style={{ width: `${Math.min(parseFloat(stat.usageRate), 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            ) : view === 'employees' ? (
                <div className="bg-white/80 backdrop-blur-md p-10 rounded-lg border border-white/50 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Users className="w-6 h-6 text-teal-600" /> 社員別有給詳細
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {stats.employeeStats.map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => fetchUserDetail(emp.id)}
                                className="p-8 bg-white rounded-lg border border-gray-100 hover:border-teal-200 hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center text-teal-600 font-black text-xl">
                                        {emp.name.charAt(0)}
                                    </div>
                                    <button className="text-gray-300 group-hover:text-teal-600 transition-colors">
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </div>
                                <h3 className="text-lg font-black text-gray-900 mb-1">{emp.name}</h3>
                                <div className="flex items-end gap-2 mb-4">
                                    <span className="text-3xl font-black text-teal-600">{emp.totalRemaining}</span>
                                    <span className="text-gray-400 text-sm mb-1.5">日保有</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-gray-400">消化済: {emp.totalUsed}日</span>
                                        <span className="text-teal-600">{emp.usageRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-50 rounded-full h-2">
                                        <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${Math.min(parseFloat(emp.usageRate), 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setView('employees')}
                            className="bg-white p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-all"
                        >
                            <ChevronRight className="w-6 h-6 rotate-180" />
                        </button>
                        <h2 className="text-2xl font-black text-gray-800">{userDetail.user?.full_name} さんの有給詳細</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        <div className="lg:col-span-2 space-y-8">
                            <Card title="有給履歴 (付与・消化)" icon={Clock}>
                                <div className="space-y-3">
                                    {userDetail.requests.length === 0 && userDetail.grants.length === 0 ? (
                                        <p className="text-center py-8 text-gray-400">記録がありません</p>
                                    ) : (
                                        [
                                            ...userDetail.grants.map(g => ({ id: g.id, type: 'grant', date: g.valid_from, amount: g.days_granted, label: '付与', bg: 'bg-blue-50', text: 'text-blue-600' })),
                                            ...userDetail.requests.filter(r => r.status === 'approved').map(r => ({ id: r.id, type: 'usage', date: r.date_requested, amount: r.amount_days, label: r.reason || '有給消化', bg: 'bg-orange-50', text: 'text-orange-600' }))
                                        ].sort((a, b) => new Date(b.date) - new Date(a.date)).map((ev, i) => (
                                            <div key={i} className={`flex items-center justify-between p-5 rounded-md border border-gray-100 group ${ev.bg}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold ${ev.text}`}>
                                                        {ev.type === 'grant' ? '+' : '-'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800">{ev.label}</p>
                                                        <p className="text-xs text-gray-500">{ev.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black ${ev.text}`}>
                                                        {ev.amount}日
                                                    </span>
                                                    {ev.type === 'usage' && (
                                                        <button 
                                                            onClick={() => handleCancelLeave(ev.id)}
                                                            className="p-2 text-red-500 hover:text-white hover:bg-red-500 bg-red-100/50 rounded-lg transition-all"
                                                            title="予定をキャンセルする"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-8">
                            <Card title="有給を消化する" icon={Plus}>
                                <form onSubmit={handleConsumeLeave} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">使用日</label>
                                        <input type="date" name="date" required className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">使用日数</label>
                                        <input type="number" step="0.1" name="amount" defaultValue="1.0" required className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">備考</label>
                                        <textarea name="reason" className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all h-24" />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-teal-600 text-white rounded-lg font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-100">実行</button>
                                </form>
                            </Card>

                            <Card title="手動で有給を付与する" icon={UserPlus}>
                                <form onSubmit={handleManualGrant} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">付与日数</label>
                                        <input type="number" step="0.5" name="days" defaultValue="1.0" required className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">有効期限</label>
                                        <input type="date" name="expiry_date" defaultValue={format(addDays(new Date(), 730), 'yyyy-MM-dd')} required className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400">付与理由 (備考)</label>
                                        <input type="text" name="reason" placeholder="特別休暇など" className="w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-lg font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">付与を実行</button>
                                </form>
                            </Card>

                            <Card title="現在の保有内訳" icon={CheckCircle}>
                                <div className="space-y-3">
                                    {userDetail.grants.filter(g => (g.days_granted - g.days_used) > 0).map((g, i) => (
                                        <div key={i} className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex justify-between items-center">
                                            <div>
                                                <p className="text-xs text-blue-400 font-bold">有効期限: {g.expiry_date}</p>
                                                <p className="text-sm font-bold text-gray-700">{g.days_granted}日中 {g.days_used}日消化</p>
                                            </div>
                                            <span className="text-lg font-black text-blue-600">
                                                残{g.days_granted - g.days_used}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )
            }
        </div>
    );
};

export default LeaveManagement;
