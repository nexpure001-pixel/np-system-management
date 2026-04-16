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
    '種別', '支払方法', '実績月', '契約日', '初回商品発送日', '解約申出日', '返金処理日', '返金額', '振込口座', '備考', '入金依頼', '経過日数'
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
            // Mapping logic
            let oldIdx = oldHeaders.indexOf(newH);
            
            // Renamed columns handle
            if (oldIdx === -1) {
                if (newH === '商品本社返送日') oldIdx = oldHeaders.indexOf('商品到着日');
                if (newH === '伝票処理') oldIdx = oldHeaders.indexOf('登録情報・伝票処理');
                if (newH === '最終メール送信') oldIdx = oldHeaders.indexOf('返信メール');
            }

            if (oldIdx !== -1) {
                newRow[newIdx] = row[oldIdx];
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
