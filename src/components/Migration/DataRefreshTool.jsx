import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import { RefreshCw, FileUp, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export default function DataRefreshTool() {
  const [status, setStatus] = useState('idle'); // idle, processing, completed
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ matched: 0, added: 0, total: 0 });
  const [isDestructive, setIsDestructive] = useState(false); // 既存データを削除するモード

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ msg, type, id: Date.now() + Math.random() }, ...prev]);
  };

  const normalizeId = (id) => {
    if (!id) return '';
    return String(id).replace(/[^a-zA-Z0-9]/g, '');
  };

  const handleRefresh = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isDestructive && !window.confirm('【警告】既存の店舗データをすべて削除してから再構築します。本当によろしいですか？')) {
      e.target.value = '';
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          await processRefresh(results.data);
        } catch (err) {
          addLog(`❌ エラー: ${err.message}`, 'error');
          setStatus('idle');
        }
      }
    });
  };

  const processRefresh = async (csvData) => {
    setStatus('processing');
    setLogs([]);
    addLog(`🚀 ${isDestructive ? 'クリーン再構築' : 'スマート補完'}プロセスを開始します...`);

    // 1. デストラクティブモードの場合、既存データを削除
    if (isDestructive) {
      addLog('⚠️ 既存のデータを削除しています...');
      const snapshot = await getDocs(collection(db, 'stores'));
      let deleteCount = 0;
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, 'stores', d.id));
        deleteCount++;
      }
      addLog(`✅ 既存の ${deleteCount} 件を削除しました。`);
    }

    // 2. 既存のデータを取得 (マッピング用)
    addLog('📦 データベースの状態を確認中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = [];
    snapshot.forEach(doc => {
      existingStores.push({ id: doc.id, ...doc.data() });
    });

    let matchedCount = 0;
    let addedCount = 0;
    
    for (const row of csvData) {
      const csvStoreId = row['店舗ID'];
      const csvEmail = row['メールアドレス'];
      if (!csvStoreId && !csvEmail) continue;

      const normalizedCsvId = normalizeId(csvStoreId);
      
      // マッチングロジック (IDまたはメール)
      let existingRecord = isDestructive ? null : existingStores.find(s => {
        const idMatch = normalizeId(s.store_id) === normalizedCsvId;
        const emailMatch = csvEmail && s.email === csvEmail;
        return idMatch || emailMatch;
      });

      let targetDocId = null;
      let baseData = {};

      if (existingRecord) {
        targetDocId = existingRecord.id;
        baseData = { ...existingRecord };
        matchedCount++;
      } else {
        targetDocId = csvStoreId || `new_${Math.random().toString(36).substring(2)}`;
        baseData = {};
        addedCount++;
      }

      // 「提出済み」を「【両方済み】」に自動変換するマッピング
      const smartMap = (csvKey, existingKey) => {
        let val = row[csvKey];
        if (val && val !== '' && val !== '-') {
          // 文言変換ロジック
          if (val === '提出済み') return '【両方済み】';
          return val;
        }
        return baseData[existingKey] || '';
      };

      const smartMapDate = (csvKey, existingKey) => {
        const csvValue = row[csvKey];
        if (csvValue && csvValue !== '' && csvValue !== '-') {
          return csvValue;
        }
        return baseData[existingKey] || null;
      };

      const updatedData = {
        ...baseData,
        store_id: smartMap('店舗ID', 'store_id'),
        no: smartMap('店舗No', 'no'),
        store_name: smartMap('店舗名', 'store_name'),
        corporate_name: smartMap('法人名', 'corporate_name'),
        representative: smartMap('代表者名', 'representative'),
        contact_person: smartMap('担当者名', 'contact_person'),
        email: smartMap('メールアドレス', 'email'),
        password: smartMap('パスワード', 'password'),
        np_seller_id: smartMap('個人会員ID', 'np_seller_id'),
        sales_ok: smartMap('販売ステータス', 'sales_ok'),
        distinction: smartMap('区別', 'distinction'),
        payment_status: smartMap('入金状況', 'payment_status'),
        doc_consent: smartMap('同意書', 'doc_consent'),
        doc_registry: smartMap('登記簿謄本', 'doc_registry'),
        doc_resident: smartMap('住民票', 'doc_resident'),
        initial_plan: smartMap('契約プラン', 'initial_plan'),
        plan_addition: smartMap('プラン追加', 'plan_addition'),
        application_date: smartMapDate('申請フォーム受理日', 'application_date'),
        login_info_sent_date: smartMapDate('契約締結日（ログイン情報送付日）', 'login_info_sent_date'),
        payment_date: smartMapDate('入金日', 'payment_date'),
        yearly_renewal_legacy: smartMap('契約更新状況', 'yearly_renewal_legacy'),
        renewal_month: smartMap('更新月', 'renewal_month'),
        remarks: smartMap('備考', 'remarks'),
        updated_at: new Date().toISOString(),
        migration_refreshed_v3: true
      };

      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
      
      if ((matchedCount + addedCount) % 10 === 0) {
        setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
      }
    }

    setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    setStatus('completed');
    addLog(`✨ ${isDestructive ? 'クリーン再構築' : 'スマート補完'}が完了しました！`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`p-8 text-white transition-colors duration-500 bg-gradient-to-r ${isDestructive ? 'from-rose-600 to-orange-700' : 'from-emerald-600 to-teal-700'}`}>
          <div className="flex justify-between items-start">
            <div>
              <RefreshCw className={`mb-2 ${status === 'processing' ? 'animate-spin' : ''}`} size={40} />
              <h2 className="text-3xl font-bold">{isDestructive ? '全データ・クリーン再構築' : '店舗データ スマート刷新'}</h2>
              <p className="opacity-90 mt-2">
                {isDestructive ? '既存データをすべて削除し、CSVのみでピカピカに作り直します。' : '既存の不足項目を最新CSVで自動補完し、名寄せを行います。'}
              </p>
            </div>
            {status === 'idle' && (
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm border border-white/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-rose-500" 
                    checked={isDestructive}
                    onChange={(e) => setIsDestructive(e.target.checked)}
                  />
                  <div className="text-sm font-bold">
                    <div className="flex items-center gap-1 text-rose-200"><Trash2 size={14}/><span>デストラクティブモード</span></div>
                    <span>既存データを全削除する</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">{isDestructive ? '再構築済み' : 'マッチング成功'}</div>
              <div className={`text-2xl font-bold ${isDestructive ? 'text-orange-600' : 'text-emerald-600'}`}>{isDestructive ? stats.added : stats.matched}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">新規追加</div>
              <div className={`text-2xl font-bold ${isDestructive ? 'text-rose-600' : 'text-teal-600'}`}>{isDestructive ? '---' : stats.added}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">CSV総件数</div>
              <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            </div>
          </div>

          {status === 'idle' && (
            <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors bg-slate-50/50 ${isDestructive ? 'border-rose-200 hover:border-rose-400' : 'border-emerald-200 hover:border-emerald-400'}`}>
              <FileUp className={`mx-auto mb-4 ${isDestructive ? 'text-rose-400' : 'text-emerald-400'}`} size={48} />
              <p className="text-slate-600 mb-6 font-medium">店舗管理システム用新データ.csv を選択してください</p>
              <label className={`${isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-10 py-4 rounded-xl font-bold cursor-pointer transition-all shadow-lg active:scale-95 inline-block text-lg`}>
                CSVファイルを選択して開始
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
              {isDestructive && <p className="mt-4 text-rose-600 text-sm font-bold flex items-center justify-center gap-1"><AlertTriangle size={16}/> 注意：現在の店舗データはすべて消去されます</p>}
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className={`animate-spin mx-auto ${isDestructive ? 'text-rose-600' : 'text-emerald-600'}`} size={48} />
              <div className="text-xl font-bold text-slate-800">{isDestructive ? '全データを削除・再構築中...' : '名寄せ・不足項目を補完中...'}</div>
              <p className="text-slate-500">
                {isDestructive ? 'データベースをピカピカに作り直しています。' : '既存データの価値を守りつつ最新化しています。'}
              </p>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-12 space-y-6">
              <CheckCircle className="mx-auto text-emerald-500" size={64} />
              <div className="text-2xl font-bold text-slate-800">{isDestructive ? 'クリーン再構築が完了しました！' : '刷新と補完が完了しました！'}</div>
              <p className="text-slate-600">
                {isDestructive ? 'CSVのデータを唯一の正解として、DBが完全に新しくなりました。' : 'CSVの最新情報を基に、既存の空欄データが埋められました。'}
              </p>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all font-sans"
              >
                店舗ダッシュボードで確認する
              </button>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-6 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <div className="text-slate-600 italic">プログレスログを待機中...</div>}
            {logs.map((log) => (
              <div key={log.id} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : (log.type === 'warning' ? 'text-orange-300' : 'text-emerald-400')}`}>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
