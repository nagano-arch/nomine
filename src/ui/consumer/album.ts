import { baseLayout, toastScript, loadingOverlay } from '../shared/layout';

export default function albumPage() {
  return baseLayout(
    '今日の候補 - NOMINE',
    `
    ${loadingOverlay()}
    
    <div class="min-h-screen bg-gray-50">
        <!-- ヘッダー -->
        <header class="bg-white shadow-sm sticky top-0 z-10">
            <div class="max-w-5xl mx-auto px-4 py-4">
                <div class="flex items-center justify-between">
                    <button onclick="history.back()" class="text-gray-600">
                        <i class="fas fa-arrow-left text-xl"></i>
                    </button>
                    <div class="text-center flex-1">
                        <h1 class="text-lg font-black text-gray-900">今日の候補</h1>
                        <p class="text-xs text-gray-500" id="store-name">読み込み中...</p>
                    </div>
                    <div class="w-6"></div>
                </div>
            </div>
        </header>
        
        <!-- 統計情報 -->
        <div class="max-w-5xl mx-auto px-4 py-6">
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="card p-4 text-center">
                    <p class="text-2xl font-bold text-gray-900" id="total-count">-</p>
                    <p class="text-xs text-gray-600 mt-1">総エントリー</p>
                </div>
                <div class="card p-4 text-center">
                    <p class="text-2xl font-bold text-blue-600" id="photo-count">-</p>
                    <p class="text-xs text-gray-600 mt-1">写真</p>
                </div>
                <div class="card p-4 text-center">
                    <p class="text-2xl font-bold text-green-600" id="video-count">-</p>
                    <p class="text-xs text-gray-600 mt-1">動画</p>
                </div>
            </div>
            
            <!-- フィルター -->
            <div class="flex space-x-2 mb-6">
                <button onclick="filterSubmissions('all')" id="filter-all" class="flex-1 py-2 rounded-lg font-medium bg-purple-600 text-white">
                    すべて
                </button>
                <button onclick="filterSubmissions('photo')" id="filter-photo" class="flex-1 py-2 rounded-lg font-medium bg-gray-100 text-gray-600">
                    写真
                </button>
                <button onclick="filterSubmissions('video')" id="filter-video" class="flex-1 py-2 rounded-lg font-medium bg-gray-100 text-gray-600">
                    動画
                </button>
            </div>
            
            <!-- エントリー一覧 -->
            <div id="submissions-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div class="col-span-full text-center py-12">
                    <div class="loading-spinner mx-auto"></div>
                    <p class="text-gray-500 mt-4">読み込み中...</p>
                </div>
            </div>
        </div>
    </div>
    
    <!-- 詳細モーダル -->
    <div id="detail-modal" class="hidden fixed inset-0 bg-black z-50">
        <button onclick="closeDetail()" class="absolute top-4 right-4 text-white text-3xl z-10">
            <i class="fas fa-times"></i>
        </button>
        
        <div class="h-full flex items-center justify-center p-4">
            <div id="detail-content" class="max-w-2xl w-full"></div>
        </div>
        
        <!-- ナビゲーション -->
        <button onclick="prevSubmission()" class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-3xl">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button onclick="nextSubmission()" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-3xl">
            <i class="fas fa-chevron-right"></i>
        </button>
    </div>
    
    ${toastScript()}
    
    <script>
    const qrToken = window.location.pathname.split('/')[2];
    let allSubmissions = [];
    let filteredSubmissions = [];
    let currentFilter = 'all';
    let currentIndex = 0;
    
    // 初期化
    (async function() {
        await loadAlbum();
    })();
    
    // アルバム読み込み
    async function loadAlbum() {
        try {
            const response = await fetch(\`/api/public/entry/\${qrToken}/album\`);
            const data = await response.json();
            
            if (!response.ok) {
                showError(data.error || 'データの読み込みに失敗しました');
                return;
            }
            
            const albumData = data.data;
            
            document.getElementById('store-name').textContent = albumData.store_name;
            allSubmissions = albumData.submissions || [];
            
            updateStats();
            filterSubmissions('all');
            
        } catch (error) {
            console.error(error);
            showError('接続エラーが発生しました');
        }
    }
    
    // 統計更新
    function updateStats() {
        const photoCount = allSubmissions.filter(s => s.submission_type === 'photo').length;
        const videoCount = allSubmissions.filter(s => s.submission_type === 'video').length;
        
        document.getElementById('total-count').textContent = allSubmissions.length;
        document.getElementById('photo-count').textContent = photoCount;
        document.getElementById('video-count').textContent = videoCount;
    }
    
    // フィルター
    function filterSubmissions(filter) {
        currentFilter = filter;
        
        // ボタンのスタイル更新
        document.querySelectorAll('[id^="filter-"]').forEach(btn => {
            btn.className = 'flex-1 py-2 rounded-lg font-medium bg-gray-100 text-gray-600';
        });
        document.getElementById(\`filter-\${filter}\`).className = 'flex-1 py-2 rounded-lg font-medium bg-purple-600 text-white';
        
        // フィルタリング
        if (filter === 'all') {
            filteredSubmissions = allSubmissions;
        } else {
            filteredSubmissions = allSubmissions.filter(s => s.submission_type === filter);
        }
        
        renderSubmissions();
    }
    
    // エントリー表示
    function renderSubmissions() {
        const grid = document.getElementById('submissions-grid');
        
        if (filteredSubmissions.length === 0) {
            grid.innerHTML = \`
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-images text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">まだエントリーがありません</p>
                </div>
            \`;
            return;
        }
        
        grid.innerHTML = filteredSubmissions.map((sub, index) => \`
            <div onclick="showDetail(\${index})" class="aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative">
                <img src="\${sub.thumbnail_url || sub.file_url}" class="w-full h-full object-cover">
                
                <!-- タイプバッジ -->
                <div class="absolute top-2 left-2">
                    <span class="text-xs px-2 py-1 rounded \${sub.submission_type === 'photo' ? 'bg-blue-500' : 'bg-green-500'} text-white">
                        \${sub.submission_type === 'photo' ? '写真' : '動画'}
                    </span>
                </div>
                
                <!-- スコア -->
                \${sub.total_score ? \`
                    <div class="absolute bottom-2 right-2">
                        <span class="text-xs px-2 py-1 rounded bg-black/70 text-white font-bold">
                            \${sub.total_score}点
                        </span>
                    </div>
                \` : ''}
            </div>
        \`).join('');
    }
    
    // 詳細表示
    function showDetail(index) {
        currentIndex = index;
        const sub = filteredSubmissions[index];
        
        const content = document.getElementById('detail-content');
        content.innerHTML = \`
            <div class="text-center">
                \${sub.submission_type === 'photo'
                    ? \`<img src="\${sub.file_url}" class="max-w-full max-h-[70vh] mx-auto rounded-lg">\`
                    : \`<video src="\${sub.file_url}" controls class="max-w-full max-h-[70vh] mx-auto rounded-lg"></video>\`
                }
                
                \${sub.total_score ? \`
                    <div class="mt-6 bg-white/10 backdrop-blur rounded-2xl p-6">
                        <p class="text-white text-sm mb-2">AIスコア</p>
                        <p class="text-white text-5xl font-black">\${sub.total_score}</p>
                    </div>
                \` : ''}
            </div>
        \`;
        
        document.getElementById('detail-modal').classList.remove('hidden');
    }
    
    // 詳細閉じる
    function closeDetail() {
        document.getElementById('detail-modal').classList.add('hidden');
    }
    
    // 前へ
    function prevSubmission() {
        if (currentIndex > 0) {
            showDetail(currentIndex - 1);
        }
    }
    
    // 次へ
    function nextSubmission() {
        if (currentIndex < filteredSubmissions.length - 1) {
            showDetail(currentIndex + 1);
        }
    }
    
    // グローバルに公開
    window.filterSubmissions = filterSubmissions;
    window.showDetail = showDetail;
    window.closeDetail = closeDetail;
    window.prevSubmission = prevSubmission;
    window.nextSubmission = nextSubmission;
    
    // キーボードナビゲーション
    document.addEventListener('keydown', function(e) {
        if (document.getElementById('detail-modal').classList.contains('hidden')) return;
        
        if (e.key === 'Escape') {
            closeDetail();
        } else if (e.key === 'ArrowLeft') {
            prevSubmission();
        } else if (e.key === 'ArrowRight') {
            nextSubmission();
        }
    });
    </script>
    `
  );
}
