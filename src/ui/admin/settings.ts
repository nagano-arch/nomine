import { baseLayout, toastScript, loadingOverlay, apiHelperScript } from '../shared/layout';

export default function settingsPage() {
  return baseLayout(
    '設定',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen bg-gray-50">
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-black text-gray-900">NOMINE</h1>
                    <span class="text-sm text-gray-500">設定</span>
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
                    <a href="/admin/tables" class="px-3 py-4 text-sm font-medium text-gray-600 hover:text-gray-900">
                        テーブル管理
                    </a>
                    <a href="/admin/settings" class="px-3 py-4 text-sm font-medium text-purple-600 border-b-2 border-purple-600">
                        設定
                    </a>
                </div>
            </div>
        </nav>
        
        <!-- メインコンテンツ -->
        <main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <form id="settings-form" class="space-y-6">
                <!-- 基本情報 -->
                <div class="card p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">基本情報</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">店舗名</label>
                            <input type="text" id="store-name" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">業態</label>
                            <select id="business-type" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                                <option value="izakaya">居酒屋</option>
                                <option value="yakiniku">焼肉</option>
                                <option value="cafe">カフェ</option>
                                <option value="fine_dining">高級和食</option>
                                <option value="bar">バー</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 営業時間 -->
                <div class="card p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">営業時間</h2>
                    <p class="text-sm text-gray-600 mb-4">※ 24時を超える場合は25:00のように入力してください</p>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">開始時刻</label>
                            <input type="text" id="open-time" placeholder="17:00" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">終了時刻</label>
                            <input type="text" id="close-time" placeholder="25:00" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>
                </div>
                
                <!-- 特典設定 -->
                <div class="card p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">特典設定</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">写真特典</label>
                            <input type="text" id="photo-reward" placeholder="ドリンク1杯サービス" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">動画特典</label>
                            <input type="text" id="video-reward" placeholder="おすすめ一品サービス" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>
                </div>
                
                <!-- 選出上限 -->
                <div class="card p-6">
                    <h2 class="text-lg font-bold text-gray-900 mb-4">1日あたりの選出上限</h2>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">写真</label>
                            <input type="number" id="photo-limit" min="1" max="20" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">動画</label>
                            <input type="number" id="video-limit" min="1" max="10" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                        </div>
                    </div>
                </div>
                
                <!-- 保存ボタン -->
                <div class="flex justify-end space-x-4">
                    <button type="button" onclick="location.href='/admin/dashboard'" class="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                        キャンセル
                    </button>
                    <button type="submit" class="px-6 py-3 gradient-bg text-white font-bold rounded-lg btn-hover">
                        保存する
                    </button>
                </div>
            </form>
        </main>
    </div>
    
    ${toastScript()}
    ${apiHelperScript()}
    
    <script>
    let currentStoreId = 1; // デモ用
    
    // 初期化
    (async function() {
        const authData = await window.checkAuth();
        if (!authData) return;
        
        document.getElementById('user-email').textContent = authData.user.email;
        loadSettings();
    })();
    
    // 設定読み込み
    async function loadSettings() {
        try {
            const data = await window.apiRequest(\`/api/stores/\${currentStoreId}/settings\`);
            const store = data.data.store;
            
            document.getElementById('store-name').value = store.name || '';
            document.getElementById('business-type').value = store.business_type || 'izakaya';
            document.getElementById('open-time').value = store.business_open_time || '17:00';
            document.getElementById('close-time').value = store.business_close_time || '25:00';
            document.getElementById('photo-reward').value = store.photo_reward_text || '';
            document.getElementById('video-reward').value = store.video_reward_text || '';
            document.getElementById('photo-limit').value = store.photo_adopt_limit || 3;
            document.getElementById('video-limit').value = store.video_adopt_limit || 1;
        } catch (error) {
            showError('設定の読み込みに失敗しました');
            console.error(error);
        }
    }
    
    // 設定保存
    document.getElementById('settings-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const data = {
            name: document.getElementById('store-name').value,
            business_type: document.getElementById('business-type').value,
            business_open_time: document.getElementById('open-time').value,
            business_close_time: document.getElementById('close-time').value,
            photo_reward_text: document.getElementById('photo-reward').value,
            video_reward_text: document.getElementById('video-reward').value,
            photo_adopt_limit: parseInt(document.getElementById('photo-limit').value),
            video_adopt_limit: parseInt(document.getElementById('video-limit').value)
        };
        
        window.showLoading();
        
        try {
            await window.apiRequest(\`/api/stores/\${currentStoreId}/settings\`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            
            showSuccess('設定を保存しました');
        } catch (error) {
            showError(error.message);
        } finally {
            window.hideLoading();
        }
    });
    </script>
    `
  );
}
