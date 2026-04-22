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

  const formatDateForInput = (dateStr) => {
    if (!dateStr || dateStr === '' || dateStr === '-') return null;
    try {
      let clean = dateStr.replace(/\//g, '-');
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return clean;
    } catch (e) { return dateStr; }
  };

  const handleRefresh = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isDestructive && !window.confirm('既存データを削除して再構築します。')) {
      e.target.value = ''; return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try { await processRefresh(results.data); }
        catch (err) { addLog(`❌ エラー: ${err.message}`, 'error'); setStatus('idle'); }
      }
    });
  };

  const processRefresh = async (csvData) => {
    setStatus('processing');
    setLogs([]);
    addLog(`🚀 刷新を開始します...`);

    if (isDestructive) {
      addLog('⚠️ 既存データを全削除中...');
      const snapshot = await getDocs(collection(db, 'stores'));
      for (const d of snapshot.docs) { await deleteDoc(doc(db, 'stores', d.id)); }
    }

    addLog('📦 データの読み込み中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let matchedCount = 0;
    let addedCount = 0;
    
    for (const row of csvData) {
      const csvStoreId = row['店舗ID'];
      if (!csvStoreId) continue;

      const normalizedCsvId = normalizeId(csvStoreId);
      let existingRecord = isDestructive ? null : existingStores.find(s => normalizeId(s.store_id) === normalizedCsvId);

      let targetDocId = existingRecord ? existingRecord.id : csvStoreId;
      if (existingRecord) matchedCount++; else addedCount++;

      const smartMap = (csvKey, existingKey) => {
        let val = row[csvKey];
        if (val && val !== '' && val !== '-') {
          if (val === '提出済み') return '【両方済み】';
          if (csvKey === '更新月' && val.includes('月') && val !== '更新なし') {
            return val.replace('月', '');
          }
          return val;
        }
        return existingRecord ? existingRecord[existingKey] || '' : '';
      };

      const smartMapDate = (csvKey, existingKey) => {
        const val = row[csvKey];
        if (val && val !== '' && val !== '-') return formatDateForInput(val);
        return existingRecord ? existingRecord[existingKey] || null : null;
      };

      const updatedData = {
        store_id: smartMap('店舗ID', 'store_id'),
        no: smartMap('店舗No', 'no'),
        store_name: smartMap('店舗名', 'store_name'),
        corporate_name: smartMap('法人名', 'corporate_name'),
        representative: smartMap('代表者名', 'representative'),
        contact_person: smartMap('担当者名', 'contact_person'),
        email: smartMap('メールアドレス', 'email'),
        password: smartMap('パスワード', 'password'),
        np_seller_id: smartMap('個人会員ID', 'np_seller_id'),
        introducer: smartMap('紹介者', 'introducer'),
        sales_ok: smartMap('販売ステータス', 'sales_ok'),
        distinction: smartMap('区別', 'distinction'),
        payment_status: smartMap('入金状況', 'payment_status'),
        doc_consent: smartMap('同意書', 'doc_consent'),
        doc_registry: smartMap('登記簿謄本', 'doc_registry'),
        doc_resident: smartMap('住民票', 'doc_resident'),
        initial_plan: smartMap('契約プラン', 'initial_plan'),
        plan_addition: smartMap('プラン追加', 'plan_addition'),
        application_form: smartMap('申込フォーム', 'application_form'),
        application_date: smartMapDate('申請フォーム受理日', 'application_date'),
        login_info_sent_date: smartMapDate('契約締結日（ログイン情報送付日）', 'login_info_sent_date'),
        payment_date: smartMapDate('入金日', 'payment_date'),
        yearly_renewal_legacy: smartMap('契約更新状況', 'yearly_renewal_legacy'),
        renewal_month: smartMap('更新月', 'renewal_month'),
        remarks: smartMap('備考', 'remarks'),
        updated_at: new Date().toISOString(),
        migration_refreshed_v6: true
      };

      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
      if ((matchedCount + addedCount) % 20 === 0) setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    }

    setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    setStatus('completed');
    addLog(`✨ 欠落していた契約締結日を含め、すべて正常に処理されました。`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className={`p-8 text-white bg-gradient-to-r ${isDestructive ? 'from-rose-600 to-orange-700' : 'from-emerald-600 to-teal-700'}`}>
          <div className="flex justify-between items-start">
            <div>
              <RefreshCw className={`mb-2 ${status === 'processing' ? 'animate-spin' : ''}`} size={40} />
              <h2 className="text-3xl font-bold">店舗データ刷新</h2>
              <p className="opacity-90 mt-2">契約締結日も含めたフルマッピングを復元しました。</p>
            </div>
            {status === 'idle' && (
              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm border border-white/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={isDestructive} onChange={(e) => setIsDestructive(e.target.checked)}/>
                  <span className="text-sm font-bold">全削除モード</span>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className="p-8 space-y-8">
          {status === 'idle' && (
            <div className={`border-2 border-dashed rounded-2xl p-12 text-center bg-slate-50/50 ${isDestructive ? 'border-rose-200' : 'border-emerald-200'}`}>
              <FileUp className={`mx-auto mb-4 ${isDestructive ? 'text-rose-400' : 'text-emerald-400'}`} size={48} />
              <label className={`${isDestructive ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-10 py-4 rounded-xl font-bold cursor-pointer inline-block text-lg`}>
                CSVを選択
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
            </div>
          )}
          {status === 'completed' && (
            <div className="text-center py-12 space-y-6">
              <CheckCircle className="mx-auto text-emerald-500" size={64} />
              <div className="text-2xl font-bold text-slate-800">すべてのデータの刷新が完了しました！</div>
              <button onClick={() => window.location.href = '/'} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold font-sans">ダッシュボードへ戻る</button>
            </div>
          )}
          <div className="bg-slate-900 rounded-xl p-6 h-48 overflow-y-auto font-mono text-xs text-emerald-400">
            {logs.map((log) => (<div key={log.id} className="mb-1">{log.msg}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
