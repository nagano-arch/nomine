import { baseLayout, toastScript, loadingOverlay, apiHelperScript } from '../shared/layout';

export default function dashboardPage() {
  return baseLayout(
    'ダッシュボード',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen bg-gray-50">
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-black text-gray-900">NOMINE</h1>
                    <span class="text-sm text-gray-500">ダッシュボード</span>
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
                    <a href="/admin/dashboard" class="px-3 py-4 text-sm font-medium text-purple-600 border-b-2 border-purple-600">
                        ダッシュボード
                    </a>
                    <a href="/admin/submissions" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        投稿管理
                    </a>
                    <a href="/admin/tables" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        テーブル管理
                    </a>
                    <a href="/admin/settings" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        設定
                    </a>
                </div>
            </div>
        </nav>
        
        <!-- メインコンテンツ -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- 店舗選択 -->
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">店舗を選択</label>
                <select id="store-select" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <option value="">読み込み中...</option>
                </select>
            </div>
            
            <!-- 統計カード -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="card p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">本日のエントリー</p>
                            <p class="text-3xl font-bold text-gray-900 mt-2" id="total-entries">-</p>
                        </div>
                        <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-images text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">写真</p>
                            <p class="text-3xl font-bold text-gray-900 mt-2" id="photo-count">-</p>
                            <p class="text-xs text-gray-500 mt-1">選出: <span id="photo-adopted">-</span></p>
                        </div>
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-camera text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">動画</p>
                            <p class="text-3xl font-bold text-gray-900 mt-2" id="video-count">-</p>
                            <p class="text-xs text-gray-500 mt-1">選出: <span id="video-adopted">-</span></p>
                        </div>
                        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-video text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>
                
                <div class="card p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">営業日</p>
                            <p class="text-xl font-bold text-gray-900 mt-2" id="business-date">-</p>
                        </div>
                        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-calendar text-amber-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 直近のエントリー -->
            <div class="card p-6">
                <h2 class="text-lg font-bold text-gray-900 mb-4">直近のエントリー</h2>
                <div id="recent-submissions" class="space-y-4">
                    <p class="text-gray-500 text-center py-8">読み込み中...</p>
                </div>
            </div>
        </main>
    </div>
    
    ${toastScript()}
    ${apiHelperScript()}
    
    <script>
    let currentStoreId = null;
    
    // 初期化
    (async function() {
        const authData = await window.checkAuth();
        if (!authData) return;
        
        document.getElementById('user-email').textContent = authData.user.email;
        
        // テナント・店舗情報取得
        loadStores(authData.tenants);
    })();
    
    // 店舗一覧読み込み
    function loadStores(tenants) {
        const storeSelect = document.getElementById('store-select');
        
        if (!tenants || tenants.length === 0) {
            storeSelect.innerHTML = '<option value="">店舗がありません</option>';
            return;
        }
        
        // 仮: 最初のテナントの最初の店舗を表示
        // 実際はテナントごとに店舗一覧を取得する必要あり
        storeSelect.innerHTML = '<option value="1">店舗 #1（デモ）</option>';
        currentStoreId = 1;
        
        loadDashboard(currentStoreId);
    }
    
    // ダッシュボードデータ読み込み
    async function loadDashboard(storeId) {
        if (!storeId) return;
        
        try {
            const data = await window.apiRequest(\`/api/stores/\${storeId}/dashboard\`);
            
            const stats = data.data.stats;
            const businessDay = data.data.business_day;
            const recentSubmissions = data.data.recent_submissions;
            
            // 統計表示
            document.getElementById('total-entries').textContent = stats.total_entries || 0;
            document.getElementById('photo-count').textContent = stats.photo_count || 0;
            document.getElementById('video-count').textContent = stats.video_count || 0;
            document.getElementById('photo-adopted').textContent = \`\${stats.photo_adopted || 0}\`;
            document.getElementById('video-adopted').textContent = \`\${stats.video_adopted || 0}\`;
            document.getElementById('business-date').textContent = businessDay.business_date;
            
            // 直近のエントリー表示
            renderRecentSubmissions(recentSubmissions);
            
        } catch (error) {
            showError('ダッシュボードの読み込みに失敗しました');
            console.error(error);
        }
    }
    
    // 直近のエントリー表示
    function renderRecentSubmissions(submissions) {
        const container = document.getElementById('recent-submissions');
        
        if (!submissions || submissions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">まだエントリーがありません</p>';
            return;
        }
        
        container.innerHTML = submissions.map(sub => \`
            <div class="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <div class="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                    <img src="\${sub.thumbnail_url || sub.file_url}" alt="Thumbnail" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm font-medium text-gray-900">\${sub.table_name}</span>
                        <span class="text-xs px-2 py-1 rounded \${sub.submission_type === 'photo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}\">
                            \${sub.submission_type === 'photo' ? '写真' : '動画'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">スコア: \${sub.total_score || '-'} 点</p>
                </div>
                <a href="/admin/submissions" class="text-purple-600 hover:text-purple-700">
                    <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        \`).join('');
    }
    
    // 店舗選択変更
    document.getElementById('store-select').addEventListener('change', function(e) {
        currentStoreId = parseInt(e.target.value);
        loadDashboard(currentStoreId);
    });
    </script>
    `
  );
}
