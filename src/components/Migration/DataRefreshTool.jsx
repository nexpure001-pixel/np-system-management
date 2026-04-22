import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, query, where } from 'firebase/firestore';
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
    addLog('🚀 データ刷新プロセスを開始します...');

    // 1. 現状のデータをFirestoreから取得
    addLog('📦 既存のFirestoreデータを読み込み中...');
    const snapshot = await getDocs(collection(db, 'stores'));
    const existingStores = [];
    snapshot.forEach(doc => {
      existingStores.push({ id: doc.id, ...doc.data() });
    });
    addLog(`✅ 既存データ ${existingStores.length} 件を取得しました。`);

    // 2. マッチングと更新
    let matchedCount = 0;
    let addedCount = 0;
    
    // 1件ずつ処理（確実性のため）
    for (const row of csvData) {
      const csvStoreId = row['店舗ID'];
      const csvEmail = row['メールアドレス'];
      if (!csvStoreId && !csvEmail) continue;

      const normalizedCsvId = normalizeId(csvStoreId);
      
      // 既存データからマッチするものを探す
      let targetDocId = null;
      let existingRecord = existingStores.find(s => {
        const idMatch = normalizeId(s.store_id) === normalizedCsvId;
        const emailMatch = csvEmail && s.email === csvEmail;
        return idMatch || emailMatch;
      });

      if (existingRecord) {
        targetDocId = existingRecord.id;
        matchedCount++;
      } else {
        targetDocId = csvStoreId || `new_${Math.random().toString(36).substring(2)}`;
        addedCount++;
      }

      // データのマッピング (CSV -> Firestore)
      const updatedData = {
        store_id: csvStoreId,
        no: row['店舗No'] || '',
        store_name: row['店舗名'] || '',
        corporate_name: row['法人名'] || '',
        representative: row['代表者名'] || '',
        contact_person: row['担当者名'] || '',
        email: csvEmail || '',
        password: row['パスワード'] || '',
        np_seller_id: row['個人会員ID'] || '',
        sales_ok: row['販売ステータス'] || '準備中',
        distinction: row['区別'] || '通常',
        payment_status: row['入金状況'] || '未入金',
        doc_consent: row['同意書'] || '未提出',
        doc_registry: row['登記簿謄本'] || '未提出',
        doc_resident: row['住民票'] || '未提出',
        initial_plan: row['契約プラン'] || '',
        plan_addition: row['プラン追加'] || 'なし',
        application_date: row['申請フォーム受理日'] || null,
        login_info_sent_date: row['契約締結日（ログイン情報送付日）'] || null,
        payment_date: row['入金日'] || null,
        yearly_renewal_legacy: row['契約更新状況'] || '',
        renewal_month: row['更新月'] || '',
        remarks: row['備考'] || '',
        updated_at: new Date().toISOString(),
        migration_refreshed: true
      };

      // Firestoreに保存
      await setDoc(doc(collection(db, 'stores'), targetDocId), updatedData, { merge: true });
      
      if ((matchedCount + addedCount) % 10 === 0) {
        setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
      }
    }

    setStats({ matched: matchedCount, added: addedCount, total: csvData.length });
    setStatus('completed');
    addLog('✨ データ刷新が正常に完了しました！');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
          <RefreshCw className="mb-2" size={40} />
          <h2 className="text-3xl font-bold">店舗データ刷新・同期ツール</h2>
          <p className="opacity-90 mt-2">新CSVデータを基に、既存データの照合と書き換えを行います。</p>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">マッチング成功</div>
              <div className="text-2xl font-bold text-blue-600">{stats.matched}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">新規追加</div>
              <div className="text-2xl font-bold text-green-600">{stats.added}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="text-slate-500 text-sm">処理対象</div>
              <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
            </div>
          </div>

          {status === 'idle' && (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
              <FileUp className="mx-auto mb-4 text-slate-400" size={48} />
              <p className="text-slate-600 mb-6">店舗管理システム用新データ.csv をアップロードしてください</p>
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition-all shadow-lg active:scale-95 inline-block">
                CSVファイルを選択
                <input type="file" className="hidden" accept=".csv" onChange={handleRefresh} />
              </label>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="animate-spin mx-auto text-indigo-600" size={48} />
              <div className="text-xl font-bold text-slate-800">データを照合・更新中...</div>
              <p className="text-slate-500">完了までブラウザを閉じずにお待ちください。</p>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-12 space-y-6">
              <CheckCircle className="mx-auto text-green-500" size={64} />
              <div className="text-2xl font-bold text-slate-800">すべての刷新が完了しました！</div>
              <p className="text-slate-600">
                店舗IDとメールアドレスをキーに正確に紐付けされました。<br/>
                店舗管理ダッシュボードから最新の状態を確認できます。
              </p>
              <button 
                onClick={() => window.location.href = '/stores'}
                className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all"
              >
                店舗ダッシュボードへ戻る
              </button>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-6 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <div className="text-slate-600">ログを待機中...</div>}
            {logs.map((log) => (
              <div key={log.id} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
