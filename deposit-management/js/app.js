document.addEventListener('DOMContentLoaded', () => {
    // State
    let paymentsData = [];
    let rawHeader = [];
    let fileLoaded = false;
    let fileName = '入金管理システム.xlsx';
    let sortColumn = null;
    let sortAsc = true;

    // Google Apps Script (GAS) URL
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwBN2el_lk4RHsaPW4j4RGgW8jrX4xVwha_phIR4W2JltL1IY0NTRg5zxAJ0avweRGF/exec';

    // DOM Elements
    const excelUpload = document.getElementById('excelUpload');
    const loadFromGasBtn = document.getElementById('loadFromGasBtn');
    const syncToGasBtn = document.getElementById('syncToGasBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');

    const dataTable = document.getElementById('dataTable');
    const tableBody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const paymentModal = document.getElementById('paymentModal');
    const paymentForm = document.getElementById('paymentForm');
    const modalTitle = document.getElementById('modalTitle');

    // Help Modal Elements
    const openHelpBtn = document.getElementById('openHelpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
    const closeHelpModalBottomBtn = document.getElementById('closeHelpModalBottomBtn');

    const tourokuJouhouSelect = document.getElementById('tourokuJouhou');
    const rankUpBikouGroup = document.getElementById('rankUpBikouGroup');
    const rankUpBikouInput = document.getElementById('rankUpBikou');

    // Quick Add Elements
    const qaShiharaibi = document.getElementById('qaShiharaibi');
    const qaBoxIdou = document.getElementById('qaBoxIdou');
    const qaTourokuJouhou = document.getElementById('qaTourokuJouhou');
    const qaSoshikizu = document.getElementById('qaSoshikizu');
    const qaRankUp = document.getElementById('qaRankUp');
    const qaChuumonbi = document.getElementById('qaChuumonbi');
    const qaShimei = document.getElementById('qaShimei');
    const qaNyuukinKingaku = document.getElementById('qaNyuukinKingaku');
    const qaBikou = document.getElementById('qaBikou');
    const qaAddBtn = document.getElementById('qaAddBtn');

    // 金額のカンマ・太字フォーマット処理
    function formatCommaInput(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('blur', (e) => {
            let val = String(e.target.value).replace(/[^\d.-]/g, '');
            if (val && !isNaN(val)) {
                e.target.value = Number(val).toLocaleString();
            }
        });
        inputElement.addEventListener('focus', (e) => {
            let val = String(e.target.value).replace(/[^\d.-]/g, '');
            e.target.value = val;
        });
    }

    // Modalの金額入力にカンマフォーマット適用
    const modalNyuukinKingaku = document.getElementById('nyuukinKingaku');
    formatCommaInput(modalNyuukinKingaku);
    // クイックアドの金額入力にも適用
    formatCommaInput(qaNyuukinKingaku);

    // Qick Add 連打用エンターキー処理
    [qaShimei, qaNyuukinKingaku, qaBikou].forEach(el => {
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd();
                }
            });
        }
    });

    // --- Loading Animation Functions ---
    const loadingOverlay = document.getElementById('loadingOverlay');
    const heartsContainer = document.getElementById('heartsContainer');
    let heartInterval;

    function createHeart() {
        if (!heartsContainer) return;
        const heart = document.createElement('i');
        heart.classList.add('fa-solid', 'fa-heart', 'flying-heart');

        // Random horizontal position, size, and animation duration
        const left = Math.random() * 100;
        const size = Math.random() * 2 + 1; // 1rem to 3rem
        const duration = Math.random() * 3 + 3; // 3s to 6s

        heart.style.left = left + 'vw';
        heart.style.fontSize = size + 'rem';
        heart.style.animationDuration = duration + 's';

        // Randomly pick a color (cute girlish colors)
        const colors = ['#ff6b81', '#ff9a9e', '#fecfef', '#a18cd1', '#ffc3a0'];
        heart.style.color = colors[Math.floor(Math.random() * colors.length)];

        heartsContainer.appendChild(heart);

        // Remove after animation completes
        setTimeout(() => {
            if (heart.parentNode) heart.remove();
        }, duration * 1000);
    }

    function showLoading() {
        if (!loadingOverlay) return;
        loadingOverlay.classList.add('active');
        heartsContainer.innerHTML = '';
        createHeart();
        heartInterval = setInterval(createHeart, 300); // 0.3秒ごとにハート発生
    }

    function hideLoading() {
        if (!loadingOverlay) return;
        loadingOverlay.classList.remove('active');
        clearInterval(heartInterval);
        setTimeout(() => {
            heartsContainer.innerHTML = '';
        }, 500); // フェードアウト後に消去
    }

    // Event Listeners
    excelUpload.addEventListener('change', handleFileUpload);
    exportExcelBtn.addEventListener('click', handleFileExport);

    if (loadFromGasBtn) loadFromGasBtn.addEventListener('click', loadFromGoogleSheet);
    if (syncToGasBtn) syncToGasBtn.addEventListener('click', saveToGoogleSheet);
    if (qaAddBtn) qaAddBtn.addEventListener('click', handleQuickAdd);

    // Help Modal Events
    if (openHelpBtn) {
        openHelpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.classList.add('active');
        });
    }

    function closeHelpModal() {
        if (helpModal) helpModal.classList.remove('active');
    }

    if (closeHelpModalBtn) closeHelpModalBtn.addEventListener('click', closeHelpModal);
    if (closeHelpModalBottomBtn) closeHelpModalBottomBtn.addEventListener('click', closeHelpModal);
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) closeHelpModal();
        });
    }

    searchInput.addEventListener('input', () => renderTable());
    openAddModalBtn.addEventListener('click', () => openModal(null));
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    paymentForm.addEventListener('submit', handleFormSubmit);

    // 個別フィルターのイベントリスナー
    const filterInputs = document.querySelectorAll('.filter-input');
    filterInputs.forEach(input => {
        input.addEventListener('input', () => renderTable());
        input.addEventListener('change', () => renderTable());
    });

    // ソートのイベントリスナー
    document.querySelectorAll('#tableHead th.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (sortColumn === column) {
                sortAsc = !sortAsc; // 同じ列なら昇順/降順を切り替え
            } else {
                sortColumn = column;
                sortAsc = true; // 新しい列なら昇順から開始
            }

            // アイコンのリセットと更新
            document.querySelectorAll('#tableHead th.sortable i').forEach(icon => {
                icon.className = 'fa-solid fa-sort'; // 全てリセット
            });
            const currentIcon = th.querySelector('i');
            if (currentIcon) {
                currentIcon.className = sortAsc ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            }

            renderTable();
        });
    });

    // Toggle RankUp Details
    tourokuJouhouSelect.addEventListener('change', (e) => {
        if (e.target.value === 'ランクアップ') {
            rankUpBikouGroup.style.display = 'block';
        } else {
            rankUpBikouGroup.style.display = 'none';
            rankUpBikouInput.value = ''; // clear
        }
    });

    // Close modal on outside click
    paymentModal.addEventListener('click', (e) => {
        if (e.target === paymentModal) closeModal();
    });

    // --- Functions ---

    // Excelの日付シリアル値をYYYY-MM-DDに変換するフォーマッター
    function formatExcelDate(serialOrDateStr) {
        if (!serialOrDateStr) return '';
        let str = String(serialOrDateStr);
        // スラッシュ区切り（2026/02/24など）が含まれる場合は、いったんハイフンに統一
        if (str.includes('/')) {
            str = str.replace(/\//g, '-');
        }
        if (str.includes('-')) {
            // "2026-02-23T15:00:00.000Z" のような場合、GAS（スプレッドシート）上では「2026-02-24 00:00:00」を意味しているため、UTCとしてそのまま年月日を抽出するかパースする
            if (str.includes('T')) {
                // Tより前の文字列だけでは日本時間とUTCでズレる場合がある（例: 23T15:00Z -> 日本では24日）
                // したがって、Dateオブジェクトとして生成し、ローカルの年・月・日を取得する
                const date = new Date(str);
                if (!isNaN(date.getTime())) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
            }
            return str;
        }
        const serial = Number(str);
        if (isNaN(serial)) return str;

        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const jsDate = new Date(excelEpoch.getTime() + (serial * 24 * 60 * 60 * 1000));
        return jsDate.toISOString().split('T')[0];
    }

    // ファイル読み込み処理
    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        fileName = file.name;

        const reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // ヘッダーありのJSONとして読み込み
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            if (jsonData.length > 0) {
                rawHeader = jsonData[0];

                // データ行から完全に空の行を除外する
                const validRows = jsonData.slice(1).filter(row => {
                    // rowの中身が1つでも「意味のあるデータ（文字、数字など）」を含んでいるかチェック
                    return row.some(cell => {
                        if (cell === null || cell === undefined) return false;
                        if (typeof cell === 'string' && cell.trim() === '') return false;
                        if (cell === false || cell === 'FALSE' || cell === 'false') return false; // チェックボックスの未チェックのみの行も無効とする
                        return true;
                    });
                });

                paymentsData = validRows.map((row, index) => {
                    // 画像の構成: A列:支払日入力, B列:BOX移動, C列:登録情報, D列:組織図確認, E列:ランクアップ, F列:振込日, G列:氏名, H列:入金金額, I列:備考
                    return {
                        id: index,
                        shiharaibiNyuuryoku: row[0] === true || row[0] === 'TRUE' || row[0] === 'true' || row[0] === '済',
                        boxIdou: row[1] === true || row[1] === 'TRUE' || row[1] === 'true' || row[1] === '済',
                        tourokuJouhou: row[2] || '',
                        soshikizuKakunin: row[3] === true || row[3] === 'TRUE' || row[3] === 'true' || row[3] === '済',
                        rankUpBikou: row[4] || '',
                        chuumonbi: row[5] || '',
                        shimei: row[6] || '',
                        nyuukinKingaku: row[7] || '',
                        bikou: row[8] || '',
                        kanryou: row[9] === true || row[9] === 'TRUE' || row[9] === 'true' || row[9] === '済' || row[9] === '完了'
                    };
                });

                fileLoaded = true;
                openAddModalBtn.style.display = 'inline-flex';
                exportExcelBtn.style.display = 'inline-flex';
                showToast('データの読み込みに成功しました✨');
                renderTable();
            } else {
                showToast('データが空です', true);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // テーブル描画
    function renderTable() {
        if (!fileLoaded) return;
        tableBody.innerHTML = '';

        // 全体検索キーワード
        const globalKeyword = searchInput.value.toLowerCase();

        // 個別フィルターの値
        const filterShiharaibi = document.getElementById('filterShiharaibi').value;
        const filterBoxIdou = document.getElementById('filterBoxIdou').value;
        const filterTouroku = document.getElementById('filterTouroku').value.toLowerCase();
        const filterSoshikizu = document.getElementById('filterSoshikizu').value;
        const filterRankUp = document.getElementById('filterRankUp').value.toLowerCase();
        const filterDate = document.getElementById('filterDate').value.toLowerCase();
        const filterName = document.getElementById('filterName').value.toLowerCase();
        const filterAmount = document.getElementById('filterAmount').value.toLowerCase();
        const filterBikou = document.getElementById('filterBikou').value.toLowerCase();

        let filteredData = [...paymentsData].reverse(); // 新しいものを上に

        filteredData = filteredData.filter(row => {
            const shiharaibiStr = row.shiharaibiNyuuryoku ? '済' : '未';
            const boxIdouStr = row.boxIdou ? '済' : '未';
            const soshikizuStr = row.soshikizuKakunin ? '済' : '未';
            const formattedDate = formatExcelDate(row.chuumonbi);

            // 個別フィルターチェック (AND条件)
            if (filterShiharaibi && shiharaibiStr !== filterShiharaibi) return false;
            if (filterBoxIdou && boxIdouStr !== filterBoxIdou) return false;
            if (filterSoshikizu && soshikizuStr !== filterSoshikizu) return false;
            if (filterTouroku && !(row.tourokuJouhou || '').toLowerCase().includes(filterTouroku)) return false;
            if (filterRankUp && !(row.rankUpBikou || '').toLowerCase().includes(filterRankUp)) return false;
            if (filterDate && !formattedDate.toLowerCase().includes(filterDate)) return false;
            if (filterName && !(row.shimei || '').toLowerCase().includes(filterName)) return false;
            if (filterAmount && !String(row.nyuukinKingaku || '').toLowerCase().includes(filterAmount)) return false;
            if (filterBikou && !(row.bikou || '').toLowerCase().includes(filterBikou)) return false;

            // 全体検索チェック
            if (globalKeyword) {
                const searchableText = [
                    shiharaibiStr, boxIdouStr, row.tourokuJouhou, soshikizuStr,
                    row.rankUpBikou, formattedDate, row.shimei, row.nyuukinKingaku, row.bikou
                ].join(' ').toLowerCase();
                if (!searchableText.includes(globalKeyword)) return false;
            }

            return true;
        });

        // ソート処理
        if (sortColumn) {
            filteredData.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                // 日付や数値の特殊対応
                if (sortColumn === 'nyuukinKingaku') {
                    valA = Number(valA) || 0;
                    valB = Number(valB) || 0;
                } else if (sortColumn === 'chuumonbi') {
                    // 日付の場合はシリアル値でも文字列でもyyyy-mm-dd形式にしてから比較
                    valA = formatExcelDate(valA) || '';
                    valB = formatExcelDate(valB) || '';
                } else {
                    if (valA === undefined || valA === null) valA = '';
                    if (valB === undefined || valB === null) valB = '';
                    if (typeof valA === 'string') valA = valA.toLowerCase();
                    if (typeof valB === 'string') valB = valB.toLowerCase();
                }

                if (valA < valB) return sortAsc ? -1 : 1;
                if (valA > valB) return sortAsc ? 1 : -1;
                return 0;
            });
        }

        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px;">データが見つかりません 🥺</td></tr>';
            return;
        }

        filteredData.forEach(row => {
            const tr = document.createElement('tr');
            if (row.kanryou) {
                tr.classList.add('completed-row');
            }

            const renderCheckbox = (val) => val
                ? '<span class="cute-badge badge-true">✓ 済</span>'
                : '<span class="cute-badge badge-false">-</span>';

            const formattedDate = formatExcelDate(row.chuumonbi);

            tr.innerHTML = `
                <td title="${row.shiharaibiNyuuryoku ? '済' : '未'}">
                    <label class="cute-checkbox" style="display:flex; justify-content:center; margin-bottom: 0;">
                        <input type="checkbox" class="inline-edit" data-id="${row.id}" data-field="shiharaibiNyuuryoku" ${row.shiharaibiNyuuryoku ? 'checked' : ''}>
                        <span class="checkmark" style="width: 18px; height: 18px;"></span>
                    </label>
                </td>
                <td title="${row.boxIdou ? '済' : '未'}">
                    <label class="cute-checkbox" style="display:flex; justify-content:center; margin-bottom: 0;">
                        <input type="checkbox" class="inline-edit" data-id="${row.id}" data-field="boxIdou" ${row.boxIdou ? 'checked' : ''}>
                        <span class="checkmark" style="width: 18px; height: 18px;"></span>
                    </label>
                </td>
                <td title="${row.tourokuJouhou}">
                    <select class="inline-edit cute-input" data-id="${row.id}" data-field="tourokuJouhou" style="padding: 2px; font-size: 0.85em !important; border-radius: 5px !important; min-width: 80px;">
                        <option value="" ${row.tourokuJouhou === '' ? 'selected' : ''}></option>
                        <option value="未注文" ${row.tourokuJouhou === '未注文' ? 'selected' : ''}>未注文</option>
                        <option value="未登録" ${row.tourokuJouhou === '未登録' ? 'selected' : ''}>未登録</option>
                        <option value="新規" ${row.tourokuJouhou === '新規' ? 'selected' : ''}>新規</option>
                        <option value="追加" ${row.tourokuJouhou === '追加' ? 'selected' : ''}>追加</option>
                        <option value="ランクアップ" ${row.tourokuJouhou === 'ランクアップ' ? 'selected' : ''}>ﾗﾝｸｱｯﾌﾟ</option>
                        <option value="新規／追加" ${row.tourokuJouhou === '新規／追加' ? 'selected' : ''}>新規/追加</option>
                        <option value="新規／ランクアップ" ${row.tourokuJouhou === '新規／ランクアップ' ? 'selected' : ''}>新規/ﾗﾝｸｱｯﾌﾟ</option>
                        <option value="追加／ランクアップ" ${row.tourokuJouhou === '追加／ランクアップ' ? 'selected' : ''}>追加/ﾗﾝｸｱｯﾌﾟ</option>
                        <option value="リピート／購入" ${row.tourokuJouhou === 'リピート／購入' ? 'selected' : ''}>ﾘﾋﾟｰﾄ/購入</option>
                        <option value="救済" ${row.tourokuJouhou === '救済' ? 'selected' : ''}>救済</option>
                        <option value="店舗関連" ${row.tourokuJouhou === '店舗関連' ? 'selected' : ''}>店舗関連</option>
                        <option value="オートシップ" ${row.tourokuJouhou === 'オートシップ' ? 'selected' : ''}>ｵｰﾄｼｯﾌﾟ</option>
                    </select>
                </td>
                <td title="${row.soshikizuKakunin ? '済' : '未'}">
                    <label class="cute-checkbox" style="display:flex; justify-content:center; margin-bottom: 0;">
                        <input type="checkbox" class="inline-edit" data-id="${row.id}" data-field="soshikizuKakunin" ${row.soshikizuKakunin ? 'checked' : ''}>
                        <span class="checkmark" style="width: 18px; height: 18px;"></span>
                    </label>
                </td>
                <td title="${row.rankUpBikou || '-'}">
                    <select class="inline-edit cute-input" data-id="${row.id}" data-field="rankUpBikou" style="padding: 2px; font-size: 0.85em !important; border-radius: 5px !important; min-width: 80px;">
                        <option value="" ${row.rankUpBikou === '' ? 'selected' : ''}></option>
                        <option value="登録" ${row.rankUpBikou === '登録' ? 'selected' : ''}>登録</option>
                        <option value="旧登録" ${row.rankUpBikou === '旧登録' ? 'selected' : ''}>旧登録</option>
                        <option value="申請日" ${row.rankUpBikou === '申請日' ? 'selected' : ''}>申請日</option>
                        <option value="3個ok" ${row.rankUpBikou === '3個ok' ? 'selected' : ''}>3個ok</option>
                    </select>
                </td>
                <td title="${formattedDate}">
                    <input type="date" class="inline-edit cute-input" data-id="${row.id}" data-field="chuumonbi" value="${formattedDate}" style="padding: 2px 5px; font-size: 0.85em !important; border-radius: 5px !important; width: 100%; box-sizing: border-box; text-align: left;">
                </td>
                <td title="${row.shimei || ''}">
                    <input type="text" class="inline-edit cute-input" data-id="${row.id}" data-field="shimei" value="${row.shimei || ''}" placeholder="氏名" style="padding: 2px 5px; font-size: 0.85em !important; border-radius: 5px !important; width: 100%; box-sizing: border-box; font-weight: bold;">
                </td>
                <td title="${row.nyuukinKingaku ? Number(String(row.nyuukinKingaku).replace(/,/g, '')).toLocaleString() : ''}">
                    <input type="text" class="inline-edit cute-input" data-id="${row.id}" data-field="nyuukinKingaku" value="${row.nyuukinKingaku || ''}" placeholder="金額" style="padding: 2px 5px; font-size: 0.85em !important; border-radius: 5px !important; width: 100%; box-sizing: border-box; text-align: right;">
                </td>
                <td title="${row.bikou || ''}">
                    <input type="text" class="inline-edit cute-input" data-id="${row.id}" data-field="bikou" value="${row.bikou || ''}" placeholder="備考を入力" style="padding: 2px 5px; font-size: 0.85em !important; border-radius: 5px !important; width: 100%; box-sizing: border-box;">
                </td>
                <td style="text-align: center; vertical-align: middle;">
                    <label class="cute-heart-checkbox" title="完了にする">
                        <input type="checkbox" class="inline-edit" data-id="${row.id}" data-field="kanryou" ${row.kanryou ? 'checked' : ''}>
                        <i class="fa-solid fa-heart"></i>
                    </label>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // 編集ボタンのイベント
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').getAttribute('data-id');
                openModal(id);
            });
        });

        // テーブル直編集イベント
        document.querySelectorAll('.inline-edit').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const field = e.target.getAttribute('data-field');
                const row = paymentsData.find(r => r.id == parseInt(id));
                if (row) {
                    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
                        row[field] = e.target.checked;
                        if (field === 'kanryou') {
                            if (e.target.checked) {
                                e.target.closest('tr').classList.add('completed-row');
                            } else {
                                e.target.closest('tr').classList.remove('completed-row');
                            }
                        }
                    } else if (e.target.tagName === 'SELECT') {
                        row[field] = e.target.value;
                        // 登録情報からランクアップが選ばれた時、値のリセット
                        if (field === 'tourokuJouhou' && e.target.value !== 'ランクアップ' && !e.target.value.includes('ランクアップ')) {
                            row.rankUpBikou = '';
                            renderTable(); // 表示更新のため再描画
                        }
                    } else {
                        // date, text, number input など
                        if (field === 'nyuukinKingaku') {
                            // カンマを取り除いて数値として保存
                            const numericValue = String(e.target.value).replace(/,/g, '');
                            row[field] = numericValue ? Number(numericValue) : '';
                            renderTable(); // 表示をカンマ付きに更新するために再描画
                        } else {
                            row[field] = e.target.value;
                        }
                    }
                }
            });
        });
    }

    // モーダル操作
    function openModal(id = null) {
        paymentForm.reset();
        rankUpBikouGroup.style.display = 'none';

        if (id !== null) {
            modalTitle.innerHTML = '🌟 入金情報編集';
            const row = paymentsData.find(r => r.id == id);
            if (row) {
                document.getElementById('recordId').value = row.id;
                document.getElementById('shiharaibiNyuuryoku').checked = row.shiharaibiNyuuryoku;
                document.getElementById('boxIdou').checked = row.boxIdou;
                document.getElementById('tourokuJouhou').value = row.tourokuJouhou || '';
                document.getElementById('soshikizuKakunin').checked = row.soshikizuKakunin;
                document.getElementById('rankUpBikou').value = row.rankUpBikou || '';

                if (row.tourokuJouhou === 'ランクアップ') {
                    rankUpBikouGroup.style.display = 'block';
                }

                document.getElementById('chuumonbi').value = formatExcelDate(row.chuumonbi);
                document.getElementById('shimei').value = row.shimei || '';
                document.getElementById('nyuukinKingaku').value = row.nyuukinKingaku || '';
                document.getElementById('bikou').value = row.bikou || '';
            }
        } else {
            modalTitle.innerHTML = '🌟 新規入金登録';
            document.getElementById('recordId').value = '';
        }

        paymentModal.classList.add('active');
    }

    function closeModal() {
        paymentModal.classList.remove('active');
    }

    // フォーム送信（ローカルステート更新と画面上の反映）
    function handleFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('recordId').value;
        const isUpdate = id !== '';

        const payload = {
            shiharaibiNyuuryoku: document.getElementById('shiharaibiNyuuryoku').checked,
            boxIdou: document.getElementById('boxIdou').checked,
            tourokuJouhou: document.getElementById('tourokuJouhou').value,
            soshikizuKakunin: document.getElementById('soshikizuKakunin').checked,
            rankUpBikou: document.getElementById('rankUpBikou').value,
            chuumonbi: document.getElementById('chuumonbi').value,
            shimei: document.getElementById('shimei').value,
            nyuukinKingaku: document.getElementById('nyuukinKingaku').value ? Number(String(document.getElementById('nyuukinKingaku').value).replace(/,/g, '')) : '',
            bikou: document.getElementById('bikou').value
        };

        if (isUpdate) {
            const index = paymentsData.findIndex(r => r.id == id);
            if (index !== -1) {
                payload.kanryou = paymentsData[index].kanryou; // 完了状態を引き継ぐ
                paymentsData[index] = { ...paymentsData[index], ...payload };
            }
        } else {
            payload.kanryou = false; // 新規は未完了
            payload.id = Date.now();
            paymentsData.push(payload); // 元配列の一番下に追加（renderTableでreverseされるため、画面上は一番上に表示される）
        }

        closeModal();
        fileLoaded = true;
        exportExcelBtn.style.display = 'inline-flex';
        syncToGasBtn.style.display = 'inline-flex';
        showToast('画面上に追加・更新しました！✨');

        // 新規追加時はソートを解除して一番上に表示させる
        sortColumn = '';
        document.querySelectorAll('#tableHead th.sortable i').forEach(icon => {
            icon.className = 'fa-solid fa-sort'; // 全てリセット
        });

        // 画面更新
        renderTable();

        // 追加・更新後、GASへ自動保存
        saveToGoogleSheet();
    }

    // クイックアド（連続入力）の送信処理
    function handleQuickAdd() {
        if (!qaShimei.value && !qaNyuukinKingaku.value) {
            showToast('氏名か金額のどちらかは入力してください 🥺', true);
            return;
        }

        const payload = {
            id: Date.now(),
            shiharaibiNyuuryoku: qaShiharaibi.checked,
            boxIdou: qaBoxIdou.checked,
            tourokuJouhou: qaTourokuJouhou.value,
            soshikizuKakunin: qaSoshikizu.checked,
            rankUpBikou: qaRankUp.value,
            chuumonbi: qaChuumonbi.value,
            shimei: qaShimei.value,
            nyuukinKingaku: qaNyuukinKingaku.value ? Number(String(qaNyuukinKingaku.value).replace(/[^\d.-]/g, '')) : '',
            bikou: qaBikou.value,
            kanryou: false
        };

        // 配列の一番下に追加（表示時にreverseされるため一番上に表示される）
        paymentsData.push(payload);

        // データの描画フラグをオン
        fileLoaded = true;
        exportExcelBtn.style.display = 'inline-flex';
        syncToGasBtn.style.display = 'inline-flex';

        showToast('✨ 連続追加しました！（そのまま次の入力ができます）');

        // 日付以外をリセットして、すぐ氏名へフォーカスを戻す
        qaShiharaibi.checked = false;
        qaBoxIdou.checked = false;
        qaTourokuJouhou.value = '';
        qaSoshikizu.checked = false;
        qaRankUp.value = '';
        qaShimei.value = '';
        qaNyuukinKingaku.value = '';
        qaNyuukinKingaku.classList.remove('bold-amount');
        qaBikou.value = '';

        // 新規追加時はソートを解除して一番上に表示させる
        sortColumn = '';
        document.querySelectorAll('#tableHead th.sortable i').forEach(icon => {
            icon.className = 'fa-solid fa-sort'; // 全てリセット
        });

        // 画面更新
        renderTable();

        // 追加したデータをGASに自動保存
        saveToGoogleSheet();

        qaShimei.focus();
    }

    // Googleスプレッドシートから読み取り (JSONP)
    let gasTimeoutId;

    function loadFromGoogleSheet() {
        showLoading(); // 可愛いロード開始
        const script = document.createElement('script');
        script.id = 'gas-jsonp-script';
        // action=getとcallbackパラメータを付与してJSONP形式での応答を要求する
        script.src = GAS_URL + '?action=get&callback=handleGasData&t=' + new Date().getTime();
        document.body.appendChild(script);

        gasTimeoutId = setTimeout(() => {
            const s = document.getElementById('gas-jsonp-script');
            if (s) {
                s.remove();
                hideLoading();
                showToast('通信がタイムアウトしました。読込できませんでした 🥺', true);
            }
        }, 15000);
    }

    // JSONPのコールバック関数
    window.handleGasData = function (data) {
        if (gasTimeoutId) clearTimeout(gasTimeoutId);

        const s = document.getElementById('gas-jsonp-script');
        if (s) s.remove();

        hideLoading(); // ロード終了
        if (!data || !Array.isArray(data)) {
            showToast('データの読み込みに失敗しました 🥺', true);
            return;
        }

        paymentsData = data.map((row, index) => {
            return {
                id: index,
                shiharaibiNyuuryoku: row.shiharaibiNyuuryoku === true || row.shiharaibiNyuuryoku === 'TRUE' || row.shiharaibiNyuuryoku === 'true',
                boxIdou: row.boxIdou === true || row.boxIdou === 'TRUE' || row.boxIdou === 'true',
                tourokuJouhou: row.tourokuJouhou || '',
                soshikizuKakunin: row.soshikizuKakunin === true || row.soshikizuKakunin === 'TRUE' || row.soshikizuKakunin === 'true',
                rankUpBikou: row.rankUpBikou || '',
                chuumonbi: row.chuumonbi ? formatExcelDate(row.chuumonbi).replace(/-/g, '/') : '',
                shimei: row.shimei || '',
                nyuukinKingaku: row.nyuukinKingaku || '',
                bikou: row.bikou || '',
                kanryou: row.kanryou === true || row.kanryou === 'TRUE' || row.kanryou === 'true'
            };
        });

        fileLoaded = true;
        openAddModalBtn.style.display = 'inline-flex';
        exportExcelBtn.style.display = 'inline-flex';
        showToast('✨ スプレッドシートからデータを読み込みました ✨');
        renderTable();
    };

    // Googleスプレッドシートへデータ送信（一括上書き）
    function saveToGoogleSheet() {
        if (!fileLoaded || paymentsData.length === 0) {
            showToast('保存するデータがありません', true);
            return;
        }

        // GASへ保存する際は、日付を「YYYY/MM/DD」形式（スラッシュ付き）へ変換する
        const payloadToSend = paymentsData.map(row => {
            let formattedDate = row.chuumonbi;
            if (formattedDate) {
                formattedDate = formatExcelDate(formattedDate).replace(/-/g, '/');
            }
            return {
                ...row,
                chuumonbi: formattedDate
            };
        });

        showLoading(); // 可愛いロード開始
        fetch(GAS_URL + '?action=post', {
            method: 'POST',
            body: JSON.stringify(payloadToSend)
        })
            .then(() => {
                hideLoading(); // ロード終了
                console.log('GASへ一括データ送信完了 (no-cors)');
                showToast('✨ スプレッドシートへ一括保存が完了しました！ ✨');
            })
            .catch(error => {
                hideLoading();
                console.error('GAS送信エラー:', error);
                showToast('スプレッドシートへの通信に失敗しました 🥺', true);
            });
    }

    // Excelとして保存（ダウンロード）
    function handleFileExport() {
        if (!fileLoaded) return;

        // rawHeaderと、更新されたrowsを2次元配列に再構築
        let newData = [rawHeader];
        // 万が一ヘッダーが空の場合のリカバリ
        if (newData[0].length === 0) {
            newData[0] = ["支払日入力", "BOX移動", "登録情報", "組織図確認", "ランクアップ", "注文/振込日", "氏名", "ご入金金額", "備考", "完了"];
        } else if (newData[0].length < 10 && !newData[0].includes("完了")) {
            newData[0].push("完了");
        }

        paymentsData.forEach(r => {
            const newRow = Array(rawHeader.length > 20 ? rawHeader.length : 20).fill('');
            newRow[0] = r.shiharaibiNyuuryoku ? true : false;
            newRow[1] = r.boxIdou ? true : false;
            newRow[2] = r.tourokuJouhou || '';
            newRow[3] = r.soshikizuKakunin ? true : false;
            newRow[4] = r.rankUpBikou || '';
            newRow[5] = r.chuumonbi ? formatExcelDate(r.chuumonbi).replace(/-/g, '/') : '';
            newRow[6] = r.shimei || '';
            newRow[7] = typeof r.nyuukinKingaku === 'string' ? parseFloat(r.nyuukinKingaku) || '' : r.nyuukinKingaku;
            newRow[8] = r.bikou || '';
            newRow[9] = r.kanryou ? true : false;
            newData.push(newRow);
        });

        const wb = XLSX.utils.book_new();
        const newSheet = XLSX.utils.aoa_to_sheet(newData);
        XLSX.utils.book_append_sheet(wb, newSheet, 'シート1');

        // ダウンロードをトリガー
        XLSX.writeFile(wb, fileName);
        showToast('Excelファイルをダウンロードしました！💖');
    }

    // トースト通知
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const countSpan = document.getElementById('toastMessage');
        const icon = toast.querySelector('i');

        countSpan.textContent = message;
        if (isError) {
            toast.style.borderLeftColor = 'red';
            icon.className = 'fa-solid fa-circle-exclamation';
            icon.style.color = 'red';
        } else {
            toast.style.borderLeftColor = 'var(--accent-color)';
            icon.className = 'fa-solid fa-circle-check';
            icon.style.color = 'var(--accent-color)';
        }

        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
