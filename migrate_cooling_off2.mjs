import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aosrdhlxfewpqhgjfmjb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvc3JkaGx4ZmV3cHFoZ2pmbWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTQ0NDgsImV4cCI6MjA4NDQzMDQ0OH0.OY1lZAfzjq0FOExufZjJ2pwqmF83ge8XSeQ5_mxB3hs';

const supabase = createClient(supabaseUrl, supabaseKey);

const DASHBOARD_COLUMNS = [
    'No.', 'お名前', '申出方法', '対応方法', '商品本社返送日', 'カード決済取消日or返金日', 
    '登録変更3項目', '伝票処理', '最終メール送信', 'リジョン発送', '完了'
];

const NEW_HEADERS = [
    ...DASHBOARD_COLUMNS,
    '種別', '支払方法', '実績月', '契約日', '初回商品到着日', '解約申出日', '返金処理日', '返金額', '振込口座', '備考', '返金依頼', '経過日数',
    'コミッション発生', 'ステイタス変更', 'クーリングオフ日付入力', '口座情報クリア'
];

async function migrate() {
    console.log('Fetching latest cooling_off_records...');
    const { data: latestRecord, error: fetchError } = await supabase
        .from('cooling_off_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fetchError || !latestRecord) {
        console.error('Error or no record found:', fetchError);
        return;
    }

    const oldHeaders = latestRecord.headers;
    const oldData = latestRecord.data;

    console.log('Mapping data to new headers...');
    const newData = oldData.map(row => {
        const newRow = new Array(NEW_HEADERS.length).fill('');
        
        NEW_HEADERS.forEach((newH, newIdx) => {
            let oldIdx = oldHeaders.indexOf(newH);
            
            // Renamed columns handling
            if (oldIdx === -1) {
                if (newH === '初回商品到着日') oldIdx = oldHeaders.indexOf('初回商品発送日');
                if (newH === '返金依頼') oldIdx = oldHeaders.indexOf('入金依頼');
            }

            if (oldIdx !== -1) {
                newRow[newIdx] = row[oldIdx];
            } else if (['ステイタス変更', 'クーリングオフ日付入力', '口座情報クリア'].includes(newH)) {
                // Checkboxes init to false
                newRow[newIdx] = false;
            }
        });
        return newRow;
    });

    console.log('Inserting migrated record...');
    const { error: insertError } = await supabase
        .from('cooling_off_records')
        .insert([{ headers: NEW_HEADERS, data: newData }]);

    if (insertError) {
        console.error('Error inserting migrated record:', insertError);
    } else {
        console.log('Migration successful! New record inserted with updated headers.');
    }
}

migrate();
