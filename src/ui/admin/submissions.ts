import { baseLayout, toastScript, loadingOverlay, apiHelperScript } from '../shared/layout';

export default function submissionsPage() {
  return baseLayout(
    '投稿管理',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen bg-gray-50">
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-black text-gray-900">NOMINE</h1>
                    <span class="text-sm text-gray-500">投稿管理</span>
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
                    <a href="/admin/submissions" class="px-3 py-4 text-sm font-medium text-purple-600 border-b-2 border-purple-600">
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
            <!-- フィルター -->
            <div class="card p-6 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">タイプ</label>
                        <select id="filter-type" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            <option value="">すべて</option>
                            <option value="photo">写真</option>
                            <option value="video">動画</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
                        <select id="filter-status" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            <option value="">すべて</option>
                            <option value="pending">未選出</option>
                            <option value="adopted">選出済み</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="loadSubmissions()" class="w-full gradient-bg text-white font-bold py-2 rounded-lg btn-hover">
                            <i class="fas fa-search mr-2"></i> 検索
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- エントリー一覧 -->
            <div id="submissions-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <p class="text-gray-500 text-center py-8 col-span-full">読み込み中...</p>
            </div>
        </main>
    </div>
    
    <!-- エントリー詳細モーダル -->
    <div id="detail-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-900">エントリー詳細</h3>
                    <button onclick="closeDetailModal()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                <div id="detail-content"></div>
            </div>
        </div>
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
        loadSubmissions();
    })();
    
    // エントリー一覧読み込み
    async function loadSubmissions() {
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (status) params.append('status', status);
        
        try {
            const data = await window.apiRequest(\`/api/stores/\${currentStoreId}/submissions?\${params}\`);
            renderSubmissions(data.data.submissions);
        } catch (error) {
            showError('エントリーの読み込みに失敗しました');
            console.error(error);
        }
    }
    
    // エントリー表示
    function renderSubmissions(submissions) {
        const container = document.getElementById('submissions-container');
        
        if (!submissions || submissions.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-full">エントリーがありません</p>';
            return;
        }
        
        container.innerHTML = submissions.map(sub => \`
            <div class="card overflow-hidden cursor-pointer hover:shadow-lg transition" onclick="showDetail(\${sub.id})">
                <div class="aspect-square bg-gray-200 overflow-hidden">
                    <img src="\${sub.thumbnail_url || sub.file_url}" alt="Submission" class="w-full h-full object-cover">
                </div>
                <div class="p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs px-2 py-1 rounded \${sub.submission_type === 'photo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}\">
                            \${sub.submission_type === 'photo' ? '写真' : '動画'}
                        </span>
                        <span class="text-xs px-2 py-1 rounded \${sub.status === 'adopted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}\">
                            \${sub.status === 'adopted' ? '選出済み' : '未選出'}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600">テーブル: \${sub.table_name}</p>
                    <p class="text-lg font-bold text-gray-900 mt-1">スコア: \${sub.total_score || '-'} 点</p>
                    <p class="text-xs text-gray-500 mt-2 line-clamp-2">\${sub.ai_comment || ''}</p>
                </div>
            </div>
        \`).join('');
    }
    
    // 詳細表示
    async function showDetail(submissionId) {
        try {
            const data = await window.apiRequest(\`/api/stores/\${currentStoreId}/submissions/\${submissionId}\`);
            const sub = data.data.submission;
            
            const content = document.getElementById('detail-content');
            content.innerHTML = \`
                <div class="space-y-6">
                    <div class="aspect-video bg-gray-200 rounded-lg overflow-hidden">
                        \${sub.submission_type === 'photo' 
                            ? \`<img src="\${sub.file_url}" class="w-full h-full object-contain">\`
                            : \`<video src="\${sub.file_url}" controls class="w-full h-full"></video>\`
                        }
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-600">タイプ</p>
                            <p class="font-medium">\${sub.submission_type === 'photo' ? '写真' : '動画'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">テーブル</p>
                            <p class="font-medium">\${sub.table_name}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">ステータス</p>
                            <p class="font-medium">\${sub.status === 'adopted' ? '選出済み' : '未選出'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">Instagram</p>
                            <p class="font-medium">\${sub.instagram_account ? '@' + sub.instagram_account : 'なし'}</p>
                        </div>
                    </div>
                    
                    <div>
                        <p class="text-sm text-gray-600 mb-2">AI採点結果</p>
                        <div class="bg-gray-50 p-4 rounded-lg space-y-2">
                            <div class="flex justify-between">
                                <span>シズル感</span>
                                <span class="font-bold">\${sub.sizzle_score || '-'} 点</span>
                            </div>
                            <div class="flex justify-between">
                                <span>構図</span>
                                <span class="font-bold">\${sub.composition_score || '-'} 点</span>
                            </div>
                            <div class="flex justify-between">
                                <span>臨場感</span>
                                <span class="font-bold">\${sub.liveliness_score || '-'} 点</span>
                            </div>
                            <div class="flex justify-between">
                                <span>公式適性</span>
                                <span class="font-bold">\${sub.official_fit_score || '-'} 点</span>
                            </div>
                            <div class="border-t pt-2 flex justify-between text-lg">
                                <span class="font-bold">総合スコア</span>
                                <span class="font-bold text-purple-600">\${sub.total_score || '-'} 点</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-700 mt-3">\${sub.ai_comment || ''}</p>
                    </div>
                    
                    \${sub.status === 'pending' ? \`
                        <button onclick="adoptSubmission(\${sub.id})" class="w-full gradient-bg text-white font-bold py-3 rounded-lg btn-hover">
                            <i class="fas fa-check mr-2"></i> この素材を選出する
                        </button>
                    \` : \`
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                            <i class="fas fa-check-circle text-purple-600 text-2xl mb-2"></i>
                            <p class="text-purple-800 font-medium">選出済み</p>
                            <p class="text-sm text-purple-600 mt-1">特典: \${sub.adopted_reward || ''}</p>
                        </div>
                    \`}
                </div>
            \`;
            
            document.getElementById('detail-modal').classList.remove('hidden');
        } catch (error) {
            showError('詳細の読み込みに失敗しました');
            console.error(error);
        }
    }
    
    // モーダルを閉じる
    function closeDetailModal() {
        document.getElementById('detail-modal').classList.add('hidden');
    }
    
    // 選出実行
    async function adoptSubmission(submissionId) {
        if (!confirm('この素材を選出しますか？選出後は取り消せません。')) {
            return;
        }
        
        window.showLoading();
        
        try {
            await window.apiRequest(\`/api/stores/\${currentStoreId}/submissions/\${submissionId}/adopt\`, {
                method: 'POST'
            });
            
            showSuccess('素材を選出しました');
            closeDetailModal();
            loadSubmissions();
        } catch (error) {
            showError(error.message);
        } finally {
            window.hideLoading();
        }
    }
    
    // グローバルに公開
    window.showDetail = showDetail;
    window.closeDetailModal = closeDetailModal;
    window.adoptSubmission = adoptSubmission;
    window.loadSubmissions = loadSubmissions;
    </script>
    `
  );
}
