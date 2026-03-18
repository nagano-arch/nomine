import { baseLayout, toastScript, loadingOverlay } from '../shared/layout';

export default function entryPage() {
  const qrToken = '{{QR_TOKEN}}'; // 実際はサーバーサイドで置換
  
  return baseLayout(
    'NOMINE',
    `
    ${loadingOverlay()}
    
    <div id="app" class="min-h-screen"></div>
    
    ${toastScript()}
    
    <script>
    const qrToken = window.location.pathname.split('/')[2];
    let storeData = null;
    let uploadedFiles = [];
    let currentStep = 'loading';
    
    // 初期化
    (async function() {
        await loadBootstrap();
    })();
    
    // ブートストラップデータ取得
    async function loadBootstrap() {
        try {
            const response = await fetch(\`/api/public/entry/\${qrToken}/bootstrap\`);
            const data = await response.json();
            
            if (!response.ok) {
                showError(data.error || 'データの読み込みに失敗しました');
                return;
            }
            
            storeData = data.data;
            
            if (!storeData.is_open) {
                renderClosedPage();
                return;
            }
            
            currentStep = 'first-view';
            render();
        } catch (error) {
            console.error(error);
            showError('接続エラーが発生しました');
        }
    }
    
    // 営業時間外画面
    function renderClosedPage() {
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen flex items-center justify-center p-6" style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);">
                <div class="text-center text-white">
                    <i class="fas fa-moon text-6xl mb-6 opacity-50"></i>
                    <h1 class="text-2xl font-bold mb-4">\${storeData.store_name}</h1>
                    <p class="text-lg mb-2">現在は営業時間外です</p>
                    <p class="text-sm opacity-75">営業時間: \${storeData.business_hours}</p>
                    <p class="text-xs mt-6 opacity-50">またのご来店をお待ちしております</p>
                </div>
            </div>
        \`;
    }
    
    // メインレンダリング
    function render() {
        switch(currentStep) {
            case 'first-view':
                renderFirstView();
                break;
            case 'select-type':
                renderSelectType();
                break;
            case 'upload':
                renderUpload();
                break;
            case 'scoring':
                renderScoring();
                break;
            case 'complete':
                renderComplete();
                break;
        }
    }
    
    // ファーストビュー
    function renderFirstView() {
        const colors = storeData.template;
        
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen flex flex-col items-center justify-center p-6 fade-in" style="background: \${colors.primary_color};">
                <div class="text-center text-white max-w-xl">
                    <h1 class="text-5xl font-black mb-4">NOMINE</h1>
                    <p class="text-xs mb-12 opacity-75">選ばれる一枚を。</p>
                    
                    <div class="bg-white/10 backdrop-blur rounded-3xl p-8 mb-8">
                        <h2 class="text-2xl font-bold mb-4 leading-relaxed">
                            \${colors.headline_text}
                        </h2>
                        <p class="text-sm opacity-90 leading-relaxed">
                            \${colors.sub_text}
                        </p>
                    </div>
                    
                    <div class="bg-white/5 backdrop-blur rounded-2xl p-6 mb-8 text-left">
                        <p class="text-xs font-bold mb-3 opacity-75">特典内容</p>
                        <div class="space-y-2">
                            <div class="flex items-center">
                                <i class="fas fa-camera text-amber-400 mr-3"></i>
                                <span class="text-sm">写真: \${storeData.rewards.photo}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-video text-amber-400 mr-3"></i>
                                <span class="text-sm">動画: \${storeData.rewards.video}</span>
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="goToSelectType()" class="w-full gradient-gold text-white font-bold py-5 rounded-2xl text-lg btn-hover shadow-xl">
                        あなたの一枚をエントリーする
                    </button>
                    
                    <p class="text-xs mt-6 opacity-50">\${storeData.table.name}</p>
                </div>
            </div>
        \`;
    }
    
    // タイプ選択
    function renderSelectType() {
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen bg-gray-50 p-6">
                <div class="max-w-xl mx-auto py-8">
                    <button onclick="backToFirstView()" class="text-gray-600 mb-6">
                        <i class="fas fa-arrow-left mr-2"></i> 戻る
                    </button>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">エントリー方法を選択</h2>
                    <p class="text-sm text-gray-600 mb-8">写真または動画をお選びください</p>
                    
                    <div class="space-y-4">
                        <button onclick="selectType('photo')" class="w-full card p-6 flex items-center justify-between hover:shadow-lg transition">
                            <div class="flex items-center">
                                <div class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mr-4">
                                    <i class="fas fa-camera text-blue-600 text-2xl"></i>
                                </div>
                                <div class="text-left">
                                    <p class="font-bold text-gray-900 mb-1">写真を選ぶ（複数OK）</p>
                                    <p class="text-xs text-gray-600">一度に複数枚アップロードできます</p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </button>
                        
                        <button onclick="selectType('video')" class="w-full card p-6 flex items-center justify-between hover:shadow-lg transition">
                            <div class="flex items-center">
                                <div class="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mr-4">
                                    <i class="fas fa-video text-green-600 text-2xl"></i>
                                </div>
                                <div class="text-left">
                                    <p class="font-bold text-gray-900 mb-1">動画を選ぶ（1本のみ）</p>
                                    <p class="text-xs text-gray-600">1回につき1本ずつの投稿です</p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400"></i>
                        </button>
                    </div>
                </div>
            </div>
        \`;
    }
    
    // アップロード画面
    function renderUpload() {
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen bg-gray-50 p-6">
                <div class="max-w-xl mx-auto py-8">
                    <button onclick="goToSelectType()" class="text-gray-600 mb-6">
                        <i class="fas fa-arrow-left mr-2"></i> 戻る
                    </button>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-8">ファイルを選択</h2>
                    
                    <div class="card p-8 mb-6">
                        <input type="file" id="file-input" multiple accept="image/*,video/*" class="hidden">
                        <button onclick="document.getElementById('file-input').click()" class="w-full border-2 border-dashed border-gray-300 rounded-2xl p-12 hover:border-purple-500 hover:bg-purple-50 transition">
                            <i class="fas fa-cloud-upload-alt text-5xl text-gray-400 mb-4"></i>
                            <p class="text-gray-700 font-medium">ファイルを選択</p>
                            <p class="text-xs text-gray-500 mt-2">タップして選択</p>
                        </button>
                    </div>
                    
                    <div class="card p-6 mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            Instagramアカウント <span class="text-gray-500">(任意)</span>
                        </label>
                        <input 
                            type="text" 
                            id="instagram-account"
                            placeholder="@your_account"
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                        <p class="text-xs text-gray-500 mt-2">選ばれた場合、公式投稿でタグ付けさせていただくことがあります</p>
                    </div>
                    
                    <button id="next-btn" onclick="proceedToScoring()" disabled class="w-full bg-gray-300 text-white font-bold py-4 rounded-2xl cursor-not-allowed">
                        AI採点へ進む
                    </button>
                </div>
            </div>
        \`;
        
        document.getElementById('file-input').addEventListener('change', handleFileSelect);
    }
    
    // ファイル選択ハンドラー
    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;
        
        // バリデーション
        // (実際の実装では詳細なチェックを追加)
        
        uploadedFiles = files;
        document.getElementById('next-btn').disabled = false;
        document.getElementById('next-btn').className = 'w-full gradient-bg text-white font-bold py-4 rounded-2xl btn-hover';
    }
    
    // AI採点画面
    async function proceedToScoring() {
        currentStep = 'scoring';
        render();
        
        // 実際のアップロード&採点（簡略化）
        setTimeout(() => {
            renderScoringResult();
        }, 2000);
    }
    
    function renderScoring() {
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div class="text-center">
                    <div class="loading-spinner mx-auto mb-6"></div>
                    <p class="text-gray-700 font-medium">AI採点中...</p>
                    <p class="text-sm text-gray-500 mt-2">少々お待ちください</p>
                </div>
            </div>
        \`;
    }
    
    function renderScoringResult() {
        // デモ用のダミースコア
        const score = {
            total_score: 85,
            sizzle_score: 88,
            composition_score: 82,
            liveliness_score: 87,
            official_fit_score: 83,
            ai_comment: '非常に魅力的な一枚です。シズル感と構図のバランスが良く、公式投稿でも十分に通用する完成度です。'
        };
        
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen bg-gray-50 p-6">
                <div class="max-w-xl mx-auto py-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">AI採点結果</h2>
                    
                    <div class="card p-8 mb-6 text-center">
                        <p class="text-sm text-gray-600 mb-2">総合スコア</p>
                        <p class="text-6xl font-black text-purple-600 mb-4">\${score.total_score}</p>
                        <p class="text-sm text-gray-700">\${score.ai_comment}</p>
                    </div>
                    
                    <div class="card p-6 mb-6">
                        <p class="text-sm font-medium text-gray-700 mb-4">詳細スコア</p>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600">シズル感</span>
                                <span class="font-bold text-gray-900">\${score.sizzle_score} 点</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600">構図</span>
                                <span class="font-bold text-gray-900">\${score.composition_score} 点</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600">臨場感</span>
                                <span class="font-bold text-gray-900">\${score.liveliness_score} 点</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600">公式適性</span>
                                <span class="font-bold text-gray-900">\${score.official_fit_score} 点</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card p-6 mb-6">
                        <div class="flex items-start">
                            <input type="checkbox" id="consent" class="w-5 h-5 mt-1 text-purple-600 rounded">
                            <label for="consent" class="ml-3 text-xs text-gray-700 leading-relaxed">
                                写真・動画は店舗の公式SNS、Web、Google等で使用される場合があること、
                                Instagramアカウントを入力した場合はタグ付けされる場合があることに同意します
                            </label>
                        </div>
                    </div>
                    
                    <button onclick="submitEntry()" class="w-full gradient-bg text-white font-bold py-4 rounded-2xl btn-hover">
                        エントリーする
                    </button>
                </div>
            </div>
        \`;
    }
    
    // エントリー確定
    async function submitEntry() {
        const consent = document.getElementById('consent').checked;
        
        if (!consent) {
            showError('利用規約への同意が必要です');
            return;
        }
        
        window.showLoading();
        
        // 実際の実装ではAPIコール
        setTimeout(() => {
            window.hideLoading();
            currentStep = 'complete';
            render();
        }, 1000);
    }
    
    // 完了画面
    function renderComplete() {
        document.getElementById('app').innerHTML = \`
            <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div class="max-w-md text-center">
                    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-check text-green-600 text-3xl"></i>
                    </div>
                    
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">エントリーありがとうございます</h2>
                    <p class="text-gray-700 mb-8">選ばれた際はスタッフからお声がけさせていただきます。</p>
                    
                    <div class="space-y-3">
                        <a href="/entry/\${qrToken}/album" class="block w-full gradient-bg text-white font-bold py-4 rounded-2xl btn-hover">
                            みんなの写真を覗く
                        </a>
                        <button onclick="location.reload()" class="block w-full border-2 border-purple-600 text-purple-600 font-bold py-4 rounded-2xl btn-hover">
                            もう一度チャレンジする
                        </button>
                    </div>
                </div>
            </div>
        \`;
    }
    
    // ナビゲーション関数
    window.goToSelectType = function() {
        currentStep = 'select-type';
        render();
    };
    
    window.backToFirstView = function() {
        currentStep = 'first-view';
        render();
    };
    
    window.selectType = function(type) {
        // タイプを保存
        currentStep = 'upload';
        render();
    };
    
    window.submitEntry = submitEntry;
    window.proceedToScoring = proceedToScoring;
    </script>
    `
  );
}
