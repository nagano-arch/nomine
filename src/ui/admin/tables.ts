import { baseLayout, toastScript, loadingOverlay, apiHelperScript } from '../shared/layout';

export default function tablesPage() {
  return baseLayout(
    'テーブル管理',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen bg-gray-50">
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-black text-gray-900">NOMINE</h1>
                    <span class="text-sm text-gray-500">テーブル管理</span>
                </div>
                <div class="flex items-center space-x-4">
                    <span id="user-email" class="text-sm text-gray-600"></span>
                    <button onclick="window.logout()" class="text-sm text-red-600 hover:text-red-700">
                        <i class="fas fa-sign-out-alt mr-1"></i> ログアウト
                    </button>
                </div>
            </div>
        </header>
        
        <!-- ナビゲーション -->
        <nav class="bg-white border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex space-x-8">
                    <a href="/admin/dashboard" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        ダッシュボード
                    </a>
                    <a href="/admin/submissions" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        投稿管理
                    </a>
                    <a href="/admin/tables" class="px-3 py-4 text-sm font-medium text-purple-600 border-b-2 border-purple-600">
                        テーブル管理
                    </a>
                    <a href="/admin/settings" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        設定
                    </a>
                </div>
            </div>
        </nav>
        
        <!-- メインコンテンツ -->
        <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- 新規作成ボタン -->
            <div class="mb-6 flex justify-end">
                <button onclick="showCreateModal()" class="gradient-bg text-white px-6 py-3 rounded-lg font-bold btn-hover">
                    <i class="fas fa-plus mr-2"></i> 新しいテーブルを追加
                </button>
            </div>
            
            <!-- テーブル一覧 -->
            <div id="tables-container" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <p class="text-gray-500 text-center py-8 col-span-full">読み込み中...</p>
            </div>
        </main>
    </div>
    
    <!-- 新規作成モーダル -->
    <div id="create-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-8">
            <h3 class="text-xl font-bold text-gray-900 mb-6">新しいテーブルを追加</h3>
            <form id="create-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">テーブルコード</label>
                    <input type="text" id="table-code" required placeholder="例: T01" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <p class="text-xs text-gray-500 mt-1">内部管理用のコード</p>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">表示名</label>
                    <input type="text" id="table-name" required placeholder="例: テーブル1" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <p class="text-xs text-gray-500 mt-1">お客様に表示される名前</p>
                </div>
                
                <div class="flex space-x-3 mt-6">
                    <button type="button" onclick="closeCreateModal()" class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        キャンセル
                    </button>
                    <button type="submit" class="flex-1 gradient-bg text-white font-bold py-2 rounded-lg btn-hover">
                        作成
                    </button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- QRコード表示モーダル -->
    <div id="qr-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-md w-full p-8 text-center">
            <h3 class="text-xl font-bold text-gray-900 mb-4" id="qr-table-name"></h3>
            <div id="qr-code" class="bg-white p-4 inline-block"></div>
            <p class="text-sm text-gray-600 mt-4">このQRコードをテーブルに設置してください</p>
            <p class="text-xs text-gray-500 mt-2">QRコードは固定で、毎日変わりません</p>
            <button onclick="closeQRModal()" class="mt-6 w-full gradient-bg text-white font-bold py-3 rounded-lg btn-hover">
                閉じる
            </button>
        </div>
    </div>
    
    ${toastScript()}
    ${apiHelperScript()}
    
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
    
    <script>
    let currentStoreId = 1; // デモ用
    
    // 初期化
    (async function() {
        const authData = await window.checkAuth();
        if (!authData) return;
        
        document.getElementById('user-email').textContent = authData.user.email;
        loadTables();
    })();
    
    // テーブル一覧読み込み
    async function loadTables() {
        try {
            const data = await window.apiRequest(\`/api/stores/\${currentStoreId}/tables\`);
            renderTables(data.data.tables);
        } catch (error) {
            showError('テーブル一覧の読み込みに失敗しました');
            console.error(error);
        }
    }
    
    // テーブル表示
    function renderTables(tables) {
        const container = document.getElementById('tables-container');
        
        if (!tables || tables.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">テーブルがありません</p>';
            return;
        }
        
        container.innerHTML = tables.map(table => \`
            <div class="card p-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">\${table.table_name}</h3>
                        <p class="text-sm text-gray-500">コード: \${table.table_code}</p>
                    </div>
                    <span class="px-3 py-1 text-xs rounded \${table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}\">
                        \${table.is_active ? '有効' : '無効'}
                    </span>
                </div>
                
                <div class="space-y-2">
                    <button onclick="showQR('\${table.qr_token}', '\${table.table_name}')" class="w-full bg-purple-50 text-purple-700 py-2 rounded-lg hover:bg-purple-100 transition">
                        <i class="fas fa-qrcode mr-2"></i> QRコードを表示
                    </button>
                    <button class="w-full bg-gray-50 text-gray-700 py-2 rounded-lg hover:bg-gray-100 transition">
                        <i class="fas fa-download mr-2"></i> PDFでダウンロード
                    </button>
                </div>
            </div>
        \`).join('');
    }
    
    // 作成モーダル表示
    function showCreateModal() {
        document.getElementById('create-modal').classList.remove('hidden');
    }
    
    // 作成モーダル閉じる
    function closeCreateModal() {
        document.getElementById('create-modal').classList.add('hidden');
        document.getElementById('create-form').reset();
    }
    
    // テーブル作成
    document.getElementById('create-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const data = {
            table_code: document.getElementById('table-code').value,
            table_name: document.getElementById('table-name').value
        };
        
        window.showLoading();
        
        try {
            await window.apiRequest(\`/api/stores/\${currentStoreId}/tables\`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            showSuccess('テーブルを作成しました');
            closeCreateModal();
            loadTables();
        } catch (error) {
            showError(error.message);
        } finally {
            window.hideLoading();
        }
    });
    
    // QRコード表示
    function showQR(token, tableName) {
        const url = \`\${window.location.origin}/entry/\${token}\`;
        
        document.getElementById('qr-table-name').textContent = tableName;
        document.getElementById('qr-code').innerHTML = '';
        
        QRCode.toCanvas(url, { width: 256, margin: 2 }, function(error, canvas) {
            if (error) {
                showError('QRコードの生成に失敗しました');
                return;
            }
            document.getElementById('qr-code').appendChild(canvas);
        });
        
        document.getElementById('qr-modal').classList.remove('hidden');
    }
    
    // QRモーダル閉じる
    function closeQRModal() {
        document.getElementById('qr-modal').classList.add('hidden');
    }
    
    // グローバルに公開
    window.showCreateModal = showCreateModal;
    window.closeCreateModal = closeCreateModal;
    window.showQR = showQR;
    window.closeQRModal = closeQRModal;
    window.loadTables = loadTables;
    </script>
    `
  );
}
