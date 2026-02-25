// Google Apps Script用 バックエンドコード

const DATA_SHEET_NAME = '店舗データ';
const HISTORY_SHEET_NAME = '更新履歴';

// 32個の全項目ヘッダー（スプレッドシートの1行目と順序一致すること推奨）
const HEADERS = [
    'salesOk', 'yearlyRenewal', 'yearlyRenewalMonth', 'no', 'npSellerId', 'introducer',
    'blankColumn', 'storeId', 'storeName', 'corporateName', 'representative', 'contactPerson',
    'email', 'password', 'initialPlan', 'planAddition', 'applicationForm', 'applicationDate',
    'initialCost', 'paymentDate', 'docConsent', 'docRegistry', 'docResident', 'emailArrivalDate',
    'originalArrivalDate', 'loginInfoSentDate', 'renewalMonth', 'remarks', 'productSettingPlan',
    'notPurchasedList', 'changedDuringActivity', 'shippingDateEntered'
];

function doGet(e) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(DATA_SHEET_NAME);
        if (!sheet) throw new Error("店舗データシートが見つかりません。");

        const data = sheet.getDataRange().getValues();
        let result = [];
        if (data.length > 1) {
            // 1行目はヘッダー前提、2行目以降データを抽出
            const sheetHeaders = data[0];
            const rows = data.slice(1);

            result = rows.map(row => {
                let obj = {};
                // スプレッドシートの列名が HEADERS 配列のキーと対応している前提
                sheetHeaders.forEach((header, index) => {
                    if (HEADERS.includes(header)) {
                        obj[header] = String(row[index] || '');
                    }
                });

                // 必須項目 storeId がない場合は生成、その他の最低限の整形
                return HEADERS.reduce((acc, key) => {
                    acc[key] = obj[key] || '';
                    return acc;
                }, {});
            }).filter(item => item.storeId !== '' || item.storeName !== '');
        }

        const jsonResult = JSON.stringify(result);
        // JSONPのサポート
        if (e && e.parameter && e.parameter.callback) {
            return ContentService.createTextOutput(`${e.parameter.callback}(${jsonResult})`)
                .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }
        return ContentService.createTextOutput(jsonResult).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        const errorJson = JSON.stringify({ error: error.message });
        if (e && e.parameter && e.parameter.callback) {
            return ContentService.createTextOutput(`${e.parameter.callback}(${errorJson})`)
                .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }
        return ContentService.createTextOutput(errorJson).setMimeType(ContentService.MimeType.JSON);
    }
}

function doPost(e) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
        const historySheet = ss.getSheetByName(HISTORY_SHEET_NAME);

        if (!dataSheet || !historySheet) throw new Error("シートが見つかりません。");

        const inputData = JSON.parse(e.postData.contents);

        // 現在のスプレッドシートの1行目のヘッダーを取得
        // ※シートの1行目も HEADERS のキー（salesOk など）になっている必要があります。
        let dataValues = dataSheet.getDataRange().getValues();

        // データが空の場合、自動的にヘッダー行を作成
        if (dataValues.length === 0 || dataValues[0].length === 0) {
            dataSheet.appendRow(HEADERS);
            historySheet.appendRow(['Timestamp', 'Action', ...HEADERS]);
            dataValues = [HEADERS];
        }

        const sheetHeaders = dataValues[0];
        let rowIndex = -1;
        const idColumnIndex = sheetHeaders.indexOf('storeId');

        if (idColumnIndex !== -1 && dataValues.length > 1) {
            for (let i = 1; i < dataValues.length; i++) {
                if (String(dataValues[i][idColumnIndex]) === String(inputData.storeId)) {
                    rowIndex = i + 1; break; // 1-indexed for GAS
                }
            }
        }

        // 履歴シートへの保存
        const timestamp = new Date();
        const action = rowIndex === -1 ? 'CREATE' : 'UPDATE';
        const historyRow = [timestamp, action].concat(HEADERS.map(key => inputData[key] !== undefined ? inputData[key] : ''));
        historySheet.appendRow(historyRow);

        // 店舗データシートへの保存（上書き または 新規追加）
        const newRowData = sheetHeaders.map(header => inputData[header] !== undefined ? inputData[header] : '');

        if (rowIndex === -1) {
            dataSheet.appendRow(newRowData);
        } else {
            dataSheet.getRange(rowIndex, 1, 1, newRowData.length).setValues([newRowData]);
        }

        return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Saved successfully.' }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}
