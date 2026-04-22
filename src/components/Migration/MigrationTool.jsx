import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Database, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const TABLES_TO_MIGRATE = [
  'stores',
  'payments',
  'cooling_off_records',
  'work_members',
  'work_requests',
  'users',
  'leave_grants',
  'leave_requests',
  'leave_consumptions',
  'manuals'
];

export default function MigrationTool() {
  const [status, setStatus] = useState('idle'); // idle, migrating, completed, error
  const [progress, setProgress] = useState({ current: '', count: 0, total: 0 });
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 50));

  const runMigration = async () => {
    if (!window.confirm('SupabaseからFirebaseへのデータ移行を開始しますか？')) return;
    
    setStatus('migrating');
    addLog('🚀 移行開始...');

    try {
      for (const table of TABLES_TO_MIGRATE) {
        setProgress(p => ({ ...p, current: table }));
        addLog(`📦 テーブル ${table} を読み込み中...`);
        
        const { data: records, error } = await supabase.from(table).select('*');
        if (error) throw new Error(`${table}の読み込み失敗: ${error.message}`);

        if (!records || records.length === 0) {
          addLog(`⚠️ ${table} は空でした。スキップします。`);
          continue;
        }

        addLog(`✅ ${records.length} 件見つかりました。Firebaseへ書き込み中...`);
        
        const BATCH_SIZE = 400;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = records.slice(i, i + BATCH_SIZE);
          
          for (const record of chunk) {
            const docId = String(record.id || record.store_id || record.np_seller_id || Math.random().toString(36).substring(2));
            const docRef = doc(collection(db, table), docId);
            batch.set(docRef, record);
          }
          
          await batch.commit();
          addLog(`   - ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length} 件完了`);
        }
      }
      
      setStatus('completed');
      addLog('✨ すべてのデータ移行が完了しました！');
    } catch (err) {
      console.error(err);
      setStatus('error');
      addLog(`❌ エラー発生: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <Database className="mx-auto mb-2" size={48} />
          <h2 className="text-2xl font-bold">Firebase データ移行ツール</h2>
          <p className="opacity-80 text-sm mt-1">SupabaseからFirebaseへデータを引っ越します</p>
        </div>

        <div className="p-8 space-y-6 text-center">
          {status === 'idle' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                このボタンを押すと、現在のデータをすべてFirebaseへ転送します。<br/>
                数分かかる場合がありますが、一度だけ実行すればOKです。
              </p>
              <button
                onClick={runMigration}
                className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
              >
                移行を開始する <ArrowRight size={20} />
              </button>
            </div>
          )}

          {status === 'migrating' && (
            <div className="space-y-4">
              <Loader2 className="mx-auto animate-spin text-indigo-600" size={48} />
              <p className="font-bold text-lg text-slate-800">
                データ移行中... [{progress.current}]
              </p>
              <p className="text-sm text-slate-400">ブラウザを閉じないでお待ちください</p>
            </div>
          )}

          {status === 'completed' && (
            <div className="space-y-4">
              <CheckCircle2 className="mx-auto text-green-500" size={64} />
              <h3 className="text-xl font-bold text-slate-800">移行完了！</h3>
              <p className="text-slate-500">
                データの移行が正常に終わりました。<br/>
                これから各画面をFirebase版に切り替えていきます。
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <AlertCircle className="mx-auto text-red-500" size={64} />
              <h3 className="text-xl font-bold text-slate-800">エラーが発生しました</h3>
              <button 
                onClick={() => setStatus('idle')}
                className="text-indigo-600 font-bold hover:underline"
              >
                もう一度試す
              </button>
            </div>
          )}

          <div className="mt-8 text-left h-48 overflow-y-auto bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400">
            {log.length === 0 && <div className="text-slate-600 italic">ログがここに表示されます...</div>}
            {log.map((m, i) => <div key={i} className="mb-1">{m}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
