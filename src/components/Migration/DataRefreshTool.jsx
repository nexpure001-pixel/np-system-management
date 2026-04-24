import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import { RefreshCw, FileUp, CheckCircle, Loader2 } from 'lucide-react';

export default function DataRefreshTool() {
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [isDestructive, setIsDestructive] = useState(false);

  const addLog = (msg, type = 'info') => setLogs(p => [{ msg, type, id: Date.now() + Math.random() }, ...p]);

  const formatDateForInput = (s) => {
    if (!s || s === '' || s === '-') return null;
    try {
      let c = s.replace(/\//g, '-');
      const p = c.split('-');
      if (p.length === 3) return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
      return c;
    } catch (e) { return s; }
  };

  const handleRefresh = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (isDestructive && !window.confirm('既存データを削除して再構築します。')) { e.target.value = ''; return; }
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (r) => { try { await processRefresh(r.data); } catch (err) { addLog(`❌ エラー: ${err.message}`, 'error'); setStatus('idle'); } } });
  };

  const processRefresh = async (csvData) => {
    setStatus('processing'); setLogs([]); addLog(`🚀 刷新を開始します...`);
    if (isDestructive) {
      addLog('⚠️ 既存データを全削除中...');
      const snapshot = await getDocs(collection(db, 'stores'));
      for (const d of snapshot.docs) { await deleteDoc(doc(db, 'stores', d.id)); }
    }
    addLog('📦 データの書き込み中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const row of csvData) {
      const csvId = row['店舗ID']; if (!csvId) continue;
      const normalizedId = String(csvId).replace(/[^a-zA-Z0-9]/g, '');
      let existingRecord = isDestructive ? null : existingStores.find(s => String(s.store_id).replace(/[^a-zA-Z0-9]/g, '') === normalizedId);
      let targetDocId = existingRecord ? existingRecord.id : csvId;

      const smartMap = (csvK, dbK) => {
        let v = row[csvK];
        if (v && v !== '' && v !== '-') {
          if (v === '提出済み') return '【両方済み】';
          if (csvK === '更新月' && v.includes('月') && v !== '更新なし') return v.replace('月', '');
          return v;
        }
        return existingRecord ? existingRecord[dbK] || '' : '';
      };

      const smartMapDate = (csvK, dbK) => {
        const v = row[csvK];
        if (v && v !== '' && v !== '-') return formatDateForInput(v);
        return existingRecord ? existingRecord[dbK] || null : null;
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
        updated_at: new Date().toISOString()
      };
      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
    }
    setStatus('completed'); addLog(`✨ すべてのデータの刷新が完了しました。`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className={`p-8 text-white bg-gradient-to-r ${isDestructive ? 'from-rose-600 to-orange-700' : 'from-emerald-600 to-teal-700'}`}>
          <div className="flex justify-between items-start">
            <div>
              <RefreshCw className={`mb-2 ${status === 'processing' ? 'animate-spin' : ''}`} size={40} />
              <h2 className="text-3xl font-bold">店舗データ刷新</h2>
            </div>
            {status === 'idle' && (
              <label className="flex items-center gap-2 cursor-pointer bg-white/20 p-2 rounded-lg">
                <input type="checkbox" checked={isDestructive} onChange={(e) => setIsDestructive(e.target.checked)} />
                <span className="text-sm font-bold">全削除モード</span>
              </label>
            )}
          </div>
        </div>
        <div className="p-8 space-y-6">
          {status === 'idle' && (
            <div className="border-2 border-dashed rounded-xl p-10 text-center bg-slate-50 border-slate-200">
              <FileUp className="mx-auto mb-4 text-slate-400" size={48} />
              <label className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold cursor-pointer inline-block shadow-lg">
                CSVを選択
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
            </div>
          )}
          {status === 'completed' && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="mx-auto text-emerald-500" size={64} />
              <button onClick={() => window.location.href = '/'} className="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold">ダッシュボードへ</button>
            </div>
          )}
          <div className="bg-slate-900 rounded-lg p-4 h-40 overflow-y-auto font-mono text-xs text-emerald-400">
            {logs.map((l) => (<div key={l.id}>{l.msg}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
