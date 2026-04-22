import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import { RefreshCw, FileUp, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export default function DataRefreshTool() {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ matched: 0, added: 0, total: 0 });
  const [isDestructive, setIsDestructive] = useState(false);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ msg, type, id: Date.now() + Math.random() }, ...prev]);
  };

  const normalizeId = (id) => {
    if (!id) return '';
    return String(id).replace(/[^a-zA-Z0-9]/g, '');
  };

  // 日付を YYYY-MM-DD 形式に正規化
  const formatDateForInput = (dateStr) => {
    if (!dateStr || dateStr === '' || dateStr === '-') return null;
    try {
      // 2023/12/27 -> 2023-12-27
      let clean = dateStr.replace(/\//g, '-');
      const parts = clean.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return clean;
    } catch (e) {
      return dateStr;
    }
  };

  const handleRefresh = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isDestructive && !window.confirm('【確認】既存データを削除して、CSVの内容でピカピカに再構築します。')) {
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
    addLog(`🚀 ${isDestructive ? '完全再構築' : 'データ刷新'}を開始します...`);

    if (isDestructive) {
      addLog('⚠️ 既存の全店舗データを削除中...');
      const snapshot = await getDocs(collection(db, 'stores'));
      for (const d of snapshot.docs) { await deleteDoc(doc(db, 'stores', d.id)); }
      addLog('✅ 削除完了。');
    }

    addLog('📦 データベースの準備中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let matchedCount = 0;
    let addedCount = 0;
    
    for (const row of csvData) {
      const csvStoreId = row['店舗ID'];
      if (!csvStoreId) continue;

      const normalizedCsvId = normalizeId(csvStoreId);
      let existingRecord = isDestructive ? null : existingStores.find(s => normalizeId(s.store_id) === normalizedCsvId);

      let targetDocId = null;
      let baseData = {};

      if (existingRecord) {
        targetDocId = existingRecord.id;
        baseData = { ...existingRecord };
        matchedCount++;
      } else {
        targetDocId = csvStoreId;
        baseData = {};
        addedCount++;
      }

      const smartMap = (csvKey, existingKey) => {
        let val = row[csvKey];
        if (val && val !== '' && val !== '-') {
          if (val === '提出済み') return '【両方済み】';
          return val;
        }
        return baseData[existingKey] || '';
      };

      const smartMapDate = (csvKey, existingKey) => {
        const csvValue = row[csvKey];
        if (csvValue && csvValue !== '' && csvValue !== '-') {
          return formatDateForInput(csvValue);
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
        migration_refreshed_v4: true
      };

      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
      
      if ((matchedCount + addedCount) % 10 === 0) {
        setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
      }
    }

    setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    setStatus('completed');
    addLog(`✨ 完了！存在する項目はすべて正規化（日付も修正）して保存されました。`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`p-8 text-white transition-colors duration-500 bg-gradient-to-r ${isDestructive ? 'from-rose-600 to-orange-700' : 'from-emerald-600 to-teal-700'}`}>
          <div className="flex justify-between items-start">
            <div>
              <RefreshCw className={`mb-2 ${status === 'processing' ? 'animate-spin' : ''}`} size={40} />
              <h2 className="text-3xl font-bold">{isDestructive ? '完全再構築' : 'データ刷新'}</h2>
              <p className="opacity-90 mt-2">日付形式の自動補正・項目名の一致を強化しました。</p>
            </div>
            {status === 'idle' && (
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm border border-white/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 accent-rose-500" checked={isDestructive} onChange={(e) => setIsDestructive(e.target.checked)}/>
                  <div className="text-sm font-bold">
                    <div className="flex items-center gap-1 text-rose-200"><Trash2 size={14}/><span>全削除モード</span></div>
                    <span>既存データを消去する</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="p-8 space-y-8">
          {status === 'idle' && (
            <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors bg-slate-50/50 ${isDestructive ? 'border-rose-200 hover:border-rose-400' : 'border-emerald-200 hover:border-emerald-400'}`}>
              <FileUp className={`mx-auto mb-4 ${isDestructive ? 'text-rose-400' : 'text-emerald-400'}`} size={48} />
              <label className={`${isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-10 py-4 rounded-xl font-bold cursor-pointer transition-all shadow-lg active:scale-95 inline-block text-lg`}>
                CSVを選択して開始
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
              <p className="mt-4 text-slate-500 text-sm">※「初期費用」「メール着」「原本着」はCSV項目に含まれていないため空欄になります。</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="animate-spin mx-auto text-emerald-600" size={48} />
              <div className="text-xl font-bold">処理中...</div>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-12 space-y-6">
              <CheckCircle className="mx-auto text-emerald-500" size={64} />
              <div className="text-2xl font-bold text-slate-800">刷新が完了しました！</div>
              <button onClick={() => window.location.href = '/'} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all font-sans">店舗管理ダッシュボードへ</button>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-6 h-64 overflow-y-auto font-mono text-xs">
            {logs.map((log) => (
              <div key={log.id} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
