import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import Papa from 'papaparse';
import { RefreshCw, FileUp, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function DataRefreshTool() {
  const [status, setStatus] = useState('idle'); // idle, processing, completed
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ matched: 0, added: 0, total: 0 });

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
    addLog('🚀 スマート刷新プロセスを開始します...');

    // 1. 現状のデータを取得
    addLog('📦 既存のFirestoreデータを読み込み中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = [];
    snapshot.forEach(doc => {
      existingStores.push({ id: doc.id, ...doc.data() });
    });
    addLog(`✅ 既存データ ${existingStores.length} 件をバックアップとして認識しました。`);

    let matchedCount = 0;
    let addedCount = 0;
    
    for (const row of csvData) {
      const csvStoreId = row['店舗ID'];
      const csvEmail = row['メールアドレス'];
      if (!csvStoreId && !csvEmail) continue;

      const normalizedCsvId = normalizeId(csvStoreId);
      
      // マッチングロジック (IDまたはメール)
      let existingRecord = existingStores.find(s => {
        const idMatch = normalizeId(s.store_id) === normalizedCsvId;
        const emailMatch = csvEmail && s.email === csvEmail;
        return idMatch || emailMatch;
      });

      let targetDocId = null;
      let baseData = {};

      if (existingRecord) {
        targetDocId = existingRecord.id;
        baseData = { ...existingRecord }; // 既存データをベースにする
        matchedCount++;
      } else {
        targetDocId = csvStoreId || `new_${Math.random().toString(36).substring(2)}`;
        baseData = {}; // 新規追加
        addedCount++;
      }

      // スマートマッピング関数: CSVに値がある時だけ更新、ない時は既存を維持
      const smartMap = (csvKey, existingKey) => {
        const csvValue = row[csvKey];
        if (csvValue && csvValue !== '' && csvValue !== '-') {
          return csvValue;
        }
        return baseData[existingKey] || '';
      };

      // 日付フィールド用
      const smartMapDate = (csvKey, existingKey) => {
        const csvValue = row[csvKey];
        if (csvValue && csvValue !== '' && csvValue !== '-') {
          return csvValue;
        }
        return baseData[existingKey] || null;
      };

      const updatedData = {
        ...baseData, // 既存の他のフィールド（paymentsの紐付き等）を保持
        store_id: smartMap('店舗ID', 'store_id'),
        no: smartMap('店舗No', 'no'),
        store_name: smartMap('店舗名', 'store_name'),
        corporate_name: smartMap('法人名', 'corporate_name'),
        representative: smartMap('代表者名', 'representative'),
        contact_person: smartMap('担当者名', 'contact_person'),
        email: smartMap('メールアドレス', 'email'),
        password: smartMap('パスワード', 'password'),
        np_seller_id: smartMap('個人会員ID', 'np_seller_id'), // ここで不足分を埋める
        sales_ok: smartMap('販売ステータス', 'sales_ok'),
        distinction: smartMap('区別', 'distinction'), // FD店舗かどうかの判定基盤
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
        migration_refreshed_v2: true
      };

      // Firestoreに保存 (merge: trueでさらに安全に)
      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
      
      if ((matchedCount + addedCount) % 10 === 0) {
        setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
      }
    }

    setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    setStatus('completed');
    addLog('✨ スマート刷新が完了しました！不足項目も補完されています。');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white">
          <RefreshCw className="mb-2" size={40} />
          <h2 className="text-3xl font-bold">店舗データ スマート刷新ツール</h2>
          <p className="opacity-90 mt-2">既存の不足項目を最新CSVで自動補完し、名寄せを行います。</p>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">マッチング(補完更新)</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.matched}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">新規追加</div>
              <div className="text-2xl font-bold text-teal-600">{stats.added}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">CSV総件数</div>
              <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            </div>
          </div>

          {status === 'idle' && (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-emerald-400 transition-colors bg-slate-50/50">
              <FileUp className="mx-auto mb-4 text-slate-400" size={48} />
              <p className="text-slate-600 mb-6">店舗管理システム用新データ.csv を選択してください</p>
              <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition-all shadow-lg active:scale-95 inline-block">
                CSVファイルを選択
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="animate-spin mx-auto text-emerald-600" size={48} />
              <div className="text-xl font-bold text-slate-800">名寄せ・不足項目を補完中...</div>
              <p className="text-slate-500">既存データの価値を守りつつ最新化しています。</p>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-12 space-y-6">
              <CheckCircle className="mx-auto text-emerald-500" size={64} />
              <div className="text-2xl font-bold text-slate-800">刷新と補完が完了しました！</div>
              <p className="text-slate-600">
                CSVの最新情報を基に、既存の空欄データが埋められました。
              </p>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-emerald-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-900 transition-all font-sans"
              >
                店舗ダッシュボードで確認する
              </button>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-6 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <div className="text-slate-600 italic">プログレスログを待機中...</div>}
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
