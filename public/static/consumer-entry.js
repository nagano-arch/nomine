// 消費者向けエントリー画面のJavaScript

let appState = {
  isOpen: false,
  store: null,
  table: null,
  businessDay: null,
  templateConfig: null,
  currentStep: 'loading', // loading, closed, home, select-type, upload-photo, upload-video, scoring, consent, complete, album
  selectedType: null,
  selectedFiles: [],
  uploadedFiles: [],
  scores: [],
  instagramAccount: '',
  consented: false
};

// アプリ初期化
async function initApp() {
  try {
    const response = await axios.get(API_BASE + '/bootstrap');
    const data = response.data;

    if (!data.is_open) {
      appState.currentStep = 'closed';
      appState.store = { name: data.store_name };
      appState.businessHours = data.business_hours;
      render();
      return;
    }

    appState.isOpen = true;
    appState.store = data.store;
    appState.table = data.table;
    appState.businessDay = data.business_day;
    appState.templateConfig = data.template_config;
    appState.currentStep = 'home';
    render();
  } catch (error) {
    console.error('Bootstrap error:', error);
    appState.currentStep = 'error';
    render();
  }
}

// レンダリング
function render() {
  const app = document.getElementById('app');
  
  switch (appState.currentStep) {
    case 'loading':
      app.innerHTML = renderLoading();
      break;
    case 'closed':
      app.innerHTML = renderClosed();
      break;
    case 'home':
      app.innerHTML = renderHome();
      break;
    case 'select-type':
      app.innerHTML = renderSelectType();
      break;
    case 'upload-photo':
      app.innerHTML = renderUploadPhoto();
      attachPhotoUploadHandlers();
      break;
    case 'upload-video':
      app.innerHTML = renderUploadVideo();
      attachVideoUploadHandlers();
      break;
    case 'scoring':
      app.innerHTML = renderScoring();
      executeScoring();
      break;
    case 'consent':
      app.innerHTML = renderConsent();
      break;
    case 'complete':
      app.innerHTML = renderComplete();
      break;
    case 'album':
      app.innerHTML = renderAlbum();
      loadAlbum();
      break;
    case 'error':
      app.innerHTML = renderError();
      break;
  }
}

// ローディング画面
function renderLoading() {
  return `
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center fade-in">
        <div class="loading-spinner mx-auto mb-4"></div>
        <p class="text-white text-lg">読み込み中...</p>
      </div>
    </div>
  `;
}

// 営業時間外画面
function renderClosed() {
  return `
    <div class="flex items-center justify-center min-h-screen fade-in">
      <div class="nomine-card p-8 max-w-md mx-auto text-center">
        <i class="fas fa-moon text-6xl text-gray-400 mb-6"></i>
        <h1 class="text-2xl font-bold text-gray-800 mb-4">営業時間外です</h1>
        <p class="text-gray-600 mb-2">${appState.store.name}</p>
        ${appState.businessHours ? `
          <p class="text-sm text-gray-500">
            営業時間: ${appState.businessHours.open} 〜 ${appState.businessHours.close}
          </p>
        ` : ''}
        <p class="text-sm text-gray-500 mt-4">営業時間内にお越しください</p>
      </div>
    </div>
  `;
}

// ホーム画面（ファーストビュー）
function renderHome() {
  const config = appState.templateConfig;
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2" style="letter-spacing: 0.1em;">NOMINE</h1>
        <p class="text-amber-400 text-sm">選ばれる一枚を。</p>
      </div>

      <div class="nomine-card p-8 mb-6">
        <div class="text-center mb-8">
          <i class="fas fa-camera text-5xl mb-4" style="color: ${config.sub_color};"></i>
          <h2 class="text-2xl font-bold text-gray-800 mb-4 leading-relaxed">
            ${config.headline_text}
          </h2>
          <p class="text-gray-600 mb-6">
            ${config.sub_text}
          </p>
        </div>

        <button 
          onclick="goToSelectType()" 
          class="btn-primary w-full py-4 rounded-full text-white font-bold text-lg shadow-lg"
        >
          あなたの一枚をエントリーする
        </button>

        <div class="mt-6 text-center">
          <p class="text-xs text-gray-500 mb-2">卓: ${appState.table.table_name}</p>
        </div>
      </div>

      <div class="text-center">
        <button 
          onclick="goToAlbum()" 
          class="text-white text-sm underline hover:text-amber-400 transition"
        >
          みんなの写真を覗く <i class="fas fa-arrow-right ml-1"></i>
        </button>
      </div>
    </div>
  `;
}

// タイプ選択画面
function renderSelectType() {
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="nomine-card p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          写真か動画を選んでください
        </h2>

        <div class="space-y-4 mb-8">
          <button 
            onclick="selectType('photo')" 
            class="w-full p-6 border-2 border-gray-200 rounded-2xl hover:border-amber-500 hover:bg-amber-50 transition"
          >
            <i class="fas fa-images text-4xl text-amber-500 mb-2"></i>
            <h3 class="font-bold text-lg mb-1">写真を選ぶ（複数OK）</h3>
            <p class="text-sm text-gray-600">複数枚一度にアップロードできます</p>
          </button>

          <button 
            onclick="selectType('video')" 
            class="w-full p-6 border-2 border-gray-200 rounded-2xl hover:border-amber-500 hover:bg-amber-50 transition"
          >
            <i class="fas fa-video text-4xl text-amber-500 mb-2"></i>
            <h3 class="font-bold text-lg mb-1">動画を選ぶ（1本のみ）</h3>
            <p class="text-sm text-gray-600">容量の関係上、1本ずつの投稿です</p>
          </button>
        </div>

        <button 
          onclick="goToHome()" 
          class="w-full py-3 text-gray-600 hover:text-gray-800 transition"
        >
          <i class="fas fa-arrow-left mr-2"></i>戻る
        </button>
      </div>
    </div>
  `;
}

// 写真アップロード画面
function renderUploadPhoto() {
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="nomine-card p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          写真を選択
        </h2>

        <div class="mb-6">
          <input 
            type="file" 
            id="photoInput" 
            accept="image/*" 
            multiple 
            class="hidden"
          />
          <label 
            for="photoInput" 
            class="block w-full p-12 border-2 border-dashed border-gray-300 rounded-2xl text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition"
          >
            <i class="fas fa-cloud-upload-alt text-5xl text-gray-400 mb-4"></i>
            <p class="text-gray-600">タップして写真を選択</p>
            <p class="text-sm text-gray-500 mt-2">複数枚選択できます</p>
          </label>
        </div>

        <div id="photoPreview" class="grid grid-cols-3 gap-2 mb-6"></div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Instagramアカウント（任意）
          </label>
          <input 
            type="text" 
            id="instagramAccount" 
            placeholder="@your_account" 
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 mt-2">
            選ばれた場合、公式投稿でタグ付けさせていただくことがあります
          </p>
        </div>

        <button 
          id="photoNextBtn" 
          onclick="handlePhotoNext()" 
          disabled 
          class="btn-primary w-full py-4 rounded-full text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          AI採点へ進む
        </button>

        <button 
          onclick="goToSelectType()" 
          class="w-full py-3 text-gray-600 hover:text-gray-800 transition mt-4"
        >
          <i class="fas fa-arrow-left mr-2"></i>戻る
        </button>
      </div>
    </div>
  `;
}

// 動画アップロード画面（写真と同様の構造）
function renderUploadVideo() {
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="nomine-card p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          動画を選択
        </h2>

        <div class="mb-6">
          <input 
            type="file" 
            id="videoInput" 
            accept="video/*" 
            class="hidden"
          />
          <label 
            for="videoInput" 
            class="block w-full p-12 border-2 border-dashed border-gray-300 rounded-2xl text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50 transition"
          >
            <i class="fas fa-video text-5xl text-gray-400 mb-4"></i>
            <p class="text-gray-600">タップして動画を選択</p>
            <p class="text-sm text-gray-500 mt-2">1本のみ選択できます</p>
          </label>
        </div>

        <div id="videoPreview" class="mb-6"></div>

        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Instagramアカウント（任意）
          </label>
          <input 
            type="text" 
            id="instagramAccountVideo" 
            placeholder="@your_account" 
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
          <p class="text-xs text-gray-500 mt-2">
            選ばれた場合、公式投稿でタグ付けさせていただくことがあります
          </p>
        </div>

        <button 
          id="videoNextBtn" 
          onclick="handleVideoNext()" 
          disabled 
          class="btn-primary w-full py-4 rounded-full text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          AI採点へ進む
        </button>

        <button 
          onclick="goToSelectType()" 
          class="w-full py-3 text-gray-600 hover:text-gray-800 transition mt-4"
        >
          <i class="fas fa-arrow-left mr-2"></i>戻る
        </button>
      </div>
    </div>
  `;
}

// 採点中画面
function renderScoring() {
  return `
    <div class="flex items-center justify-center min-h-screen fade-in">
      <div class="text-center">
        <div class="loading-spinner mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold text-white mb-2">AI採点中...</h2>
        <p class="text-gray-300">少々お待ちください</p>
      </div>
    </div>
  `;
}

// 同意画面
function renderConsent() {
  const totalScore = appState.scores.reduce((sum, s) => sum + s.total_score, 0) / appState.scores.length;
  
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="nomine-card p-8">
        <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">
          AI採点結果
        </h2>

        <div class="mb-8">
          ${appState.scores.map((score, idx) => `
            <div class="mb-6 p-4 bg-gray-50 rounded-xl">
              ${score.thumbnail_url ? `
                <img src="${score.thumbnail_url}" class="w-full h-48 object-cover rounded-lg mb-4" />
              ` : ''}
              
              <div class="flex justify-between items-center mb-3">
                <span class="text-gray-600">総合スコア</span>
                <span class="text-3xl font-bold" style="color: ${getScoreColor(score.total_score)};">
                  ${score.total_score}点
                </span>
              </div>

              <div class="space-y-2 mb-4">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">シズル感</span>
                  <span class="font-medium">${score.sizzle_score}点</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">構図</span>
                  <span class="font-medium">${score.composition_score}点</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">臨場感</span>
                  <span class="font-medium">${score.liveliness_score}点</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600">公式適性</span>
                  <span class="font-medium">${score.official_fit_score}点</span>
                </div>
              </div>

              <p class="text-sm text-gray-700 leading-relaxed">
                ${score.ai_comment}
              </p>
            </div>
          `).join('')}
        </div>

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h3 class="font-bold text-gray-800 mb-3">利用規約への同意</h3>
          <div class="text-sm text-gray-700 space-y-2 mb-4">
            <p>• 写真・動画は店舗の公式SNS、Web、Googleなどで使用される場合があります</p>
            <p>• サービス改善のため利用される場合があります</p>
            <p>• Instagramアカウントを入力した場合、タグ付けされる場合があります</p>
          </div>
          <label class="flex items-center">
            <input type="checkbox" id="consentCheckbox" class="mr-3 w-5 h-5" onchange="handleConsentChange()" />
            <span class="text-sm font-medium">上記に同意してエントリーします</span>
          </label>
        </div>

        <button 
          id="submitBtn" 
          onclick="handleSubmit()" 
          disabled 
          class="btn-primary w-full py-4 rounded-full text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          エントリーする
        </button>

        <button 
          onclick="goToHome()" 
          class="w-full py-3 text-gray-600 hover:text-gray-800 transition mt-4"
        >
          キャンセル
        </button>
      </div>
    </div>
  `;
}

// 完了画面
function renderComplete() {
  return `
    <div class="max-w-lg mx-auto fade-in">
      <div class="nomine-card p-8 text-center">
        <i class="fas fa-check-circle text-6xl text-green-500 mb-6"></i>
        <h2 class="text-2xl font-bold text-gray-800 mb-4">
          エントリーありがとうございます
        </h2>
        <p class="text-gray-600 mb-8">
          選ばれた際はスタッフからお声がけさせていただきます。
        </p>

        <button 
          onclick="goToAlbum()" 
          class="btn-primary w-full py-4 rounded-full text-white font-bold text-lg shadow-lg mb-4"
        >
          みんなの写真を覗く
        </button>

        <button 
          onclick="goToHome()" 
          class="w-full py-3 text-gray-600 hover:text-gray-800 transition"
        >
          もう一度チャレンジする
        </button>
      </div>
    </div>
  `;
}

// アルバム画面
function renderAlbum() {
  return `
    <div class="max-w-4xl mx-auto fade-in">
      <div class="nomine-card p-6 mb-6">
        <h2 class="text-2xl font-bold text-gray-800 text-center">
          <i class="fas fa-images mr-2 text-amber-500"></i>
          今日の候補
        </h2>
        ${appState.store ? `<p class="text-center text-gray-600 text-sm mt-2">${appState.store.name}</p>` : ''}
      </div>

      <div id="albumContent" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div class="col-span-full text-center py-12">
          <div class="loading-spinner mx-auto mb-4"></div>
          <p class="text-white">読み込み中...</p>
        </div>
      </div>

      <div class="text-center">
        <button 
          onclick="goToHome()" 
          class="text-white text-sm underline hover:text-amber-400 transition"
        >
          <i class="fas fa-arrow-left mr-1"></i>戻る
        </button>
      </div>
    </div>
  `;
}

// エラー画面
function renderError() {
  return `
    <div class="flex items-center justify-center min-h-screen fade-in">
      <div class="nomine-card p-8 max-w-md mx-auto text-center">
        <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-6"></i>
        <h2 class="text-2xl font-bold text-gray-800 mb-4">エラーが発生しました</h2>
        <p class="text-gray-600 mb-6">申し訳ございません。もう一度お試しください。</p>
        <button 
          onclick="location.reload()" 
          class="btn-primary px-8 py-3 rounded-full text-white font-bold"
        >
          再読み込み
        </button>
      </div>
    </div>
  `;
}

// ナビゲーション関数
function goToHome() {
  appState.currentStep = 'home';
  appState.selectedType = null;
  appState.selectedFiles = [];
  appState.uploadedFiles = [];
  appState.scores = [];
  appState.instagramAccount = '';
  appState.consented = false;
  render();
}

function goToSelectType() {
  appState.currentStep = 'select-type';
  render();
}

function goToAlbum() {
  appState.currentStep = 'album';
  render();
}

function selectType(type) {
  appState.selectedType = type;
  appState.currentStep = type === 'photo' ? 'upload-photo' : 'upload-video';
  render();
}

// 写真アップロードハンドラー
function attachPhotoUploadHandlers() {
  const input = document.getElementById('photoInput');
  const preview = document.getElementById('photoPreview');
  const btn = document.getElementById('photoNextBtn');

  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    appState.selectedFiles = files;

    preview.innerHTML = files.map((file, idx) => `
      <div class="relative">
        <img src="${URL.createObjectURL(file)}" class="w-full h-24 object-cover rounded-lg" />
      </div>
    `).join('');

    btn.disabled = files.length === 0;
  });
}

function attachVideoUploadHandlers() {
  const input = document.getElementById('videoInput');
  const preview = document.getElementById('videoPreview');
  const btn = document.getElementById('videoNextBtn');

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      appState.selectedFiles = [file];
      preview.innerHTML = `
        <video src="${URL.createObjectURL(file)}" controls class="w-full rounded-lg"></video>
      `;
      btn.disabled = false;
    }
  });
}

async function handlePhotoNext() {
  appState.instagramAccount = document.getElementById('instagramAccount').value;
  
  // モックアップ: 実際にはファイルをアップロード
  appState.uploadedFiles = appState.selectedFiles.map((file, idx) => ({
    file_url: `https://storage.nomine.app/uploads/${Date.now()}-${idx}.jpg`,
    thumbnail_url: `https://storage.nomine.app/thumbnails/${Date.now()}-${idx}.jpg`
  }));
  
  appState.currentStep = 'scoring';
  render();
}

async function handleVideoNext() {
  appState.instagramAccount = document.getElementById('instagramAccountVideo').value;
  
  appState.uploadedFiles = [{
    file_url: `https://storage.nomine.app/uploads/${Date.now()}.mp4`,
    thumbnail_url: `https://storage.nomine.app/thumbnails/${Date.now()}.jpg`
  }];
  
  appState.currentStep = 'scoring';
  render();
}

async function executeScoring() {
  try {
    const response = await axios.post(API_BASE + '/score', {
      files: appState.uploadedFiles,
      submission_type: appState.selectedType
    });

    appState.scores = response.data.scores;
    appState.currentStep = 'consent';
    render();
  } catch (error) {
    console.error('Scoring error:', error);
    alert('採点中にエラーが発生しました');
    goToHome();
  }
}

function handleConsentChange() {
  const checkbox = document.getElementById('consentCheckbox');
  const btn = document.getElementById('submitBtn');
  appState.consented = checkbox.checked;
  btn.disabled = !checkbox.checked;
}

async function handleSubmit() {
  if (!appState.consented) return;

  try {
    await axios.post(API_BASE + '/submit', {
      files: appState.uploadedFiles,
      submission_type: appState.selectedType,
      instagram_account: appState.instagramAccount,
      consented: true
    });

    appState.currentStep = 'complete';
    render();
  } catch (error) {
    console.error('Submit error:', error);
    alert('エントリー中にエラーが発生しました');
  }
}

async function loadAlbum() {
  try {
    const response = await axios.get(API_BASE + '/album');
    const data = response.data;

    const content = document.getElementById('albumContent');
    
    if (!data.submissions || data.submissions.length === 0) {
      content.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-images text-6xl text-gray-400 mb-4"></i>
          <p class="text-white">まだエントリーがありません</p>
        </div>
      `;
      return;
    }

    content.innerHTML = data.submissions.map(sub => `
      <div class="nomine-card overflow-hidden">
        <img src="${sub.thumbnail_url || sub.file_url}" class="w-full h-48 object-cover" />
        <div class="p-3">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-500">
              ${sub.submission_type === 'photo' ? '📷 写真' : '🎥 動画'}
            </span>
            ${sub.total_score ? `
              <span class="text-sm font-bold" style="color: ${getScoreColor(sub.total_score)};">
                ${sub.total_score}点
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Album error:', error);
    document.getElementById('albumContent').innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-white">読み込みに失敗しました</p>
      </div>
    `;
  }
}

function getScoreColor(score) {
  if (score >= 90) return '#10b981';
  if (score >= 80) return '#3b82f6';
  if (score >= 70) return '#f59e0b';
  if (score >= 60) return '#f97316';
  return '#ef4444';
}

// 初期化
initApp();
