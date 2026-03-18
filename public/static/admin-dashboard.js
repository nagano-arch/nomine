// 管理画面ダッシュボード

let appState = {
  user: null,
  store: null,
  dashboard: null,
  submissions: [],
  selectedSubmission: null,
  loading: true,
  currentView: 'dashboard', // dashboard, submissions, settings
  filter: {
    type: 'all',
    status: 'all'
  }
};

// 初期化
async function init() {
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    window.location.href = '/admin/login';
    return;
  }
  
  appState.user = JSON.parse(userStr);
  
  // 仮のストアID（実際はユーザーに紐づく店舗を取得）
  // この実装では最初の店舗を使用
  await loadDashboard(1);
  
  appState.loading = false;
  render();
}

async function loadDashboard(storeId) {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await axios.get(`/api/stores/${storeId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    appState.store = response.data.store;
    appState.dashboard = response.data;
  } catch (error) {
    console.error('Dashboard load error:', error);
    if (error.response?.status === 401) {
      logout();
    }
  }
}

async function loadSubmissions(storeId) {
  try {
    const token = localStorage.getItem('auth_token');
    const params = new URLSearchParams();
    
    if (appState.filter.type !== 'all') params.append('type', appState.filter.type);
    if (appState.filter.status !== 'all') params.append('status', appState.filter.status);
    if (appState.dashboard?.business_day) {
      params.append('business_day_id', appState.dashboard.business_day.id);
    }
    
    const response = await axios.get(`/api/stores/${storeId}/submissions?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    appState.submissions = response.data.submissions;
    render();
  } catch (error) {
    console.error('Submissions load error:', error);
  }
}

async function adoptSubmission(submissionId) {
  if (!confirm('この素材を選出しますか？')) return;
  
  try {
    const token = localStorage.getItem('auth_token');
    await axios.post(`/api/stores/${appState.store.id}/submissions/${submissionId}/adopt`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    alert('選出しました！');
    await loadDashboard(appState.store.id);
    await loadSubmissions(appState.store.id);
  } catch (error) {
    console.error('Adopt error:', error);
    alert(error.response?.data?.error || '選出に失敗しました');
  }
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  window.location.href = '/admin/login';
}

function render() {
  const app = document.getElementById('app');
  
  if (appState.loading) {
    app.innerHTML = renderLoading();
    return;
  }
  
  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      ${renderHeader()}
      ${renderNavigation()}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        ${renderCurrentView()}
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4"></div>
        <p class="text-gray-600">読み込み中...</p>
      </div>
    </div>
  `;
}

function renderHeader() {
  return `
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-bold text-gray-900" style="letter-spacing: 0.05em;">NOMINE</h1>
            <p class="text-sm text-gray-500 mt-1">${appState.store?.name || ''}</p>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">${appState.user?.email}</span>
            <button onclick="logout()" class="text-sm text-red-600 hover:text-red-700 font-medium">
              <i class="fas fa-sign-out-alt mr-1"></i>ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNavigation() {
  return `
    <nav class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-8">
          <button 
            onclick="switchView('dashboard')" 
            class="py-4 px-2 border-b-2 font-medium text-sm ${
              appState.currentView === 'dashboard' 
                ? 'border-amber-500 text-amber-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }"
          >
            <i class="fas fa-tachometer-alt mr-2"></i>ダッシュボード
          </button>
          <button 
            onclick="switchView('submissions')" 
            class="py-4 px-2 border-b-2 font-medium text-sm ${
              appState.currentView === 'submissions' 
                ? 'border-amber-500 text-amber-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }"
          >
            <i class="fas fa-images mr-2"></i>投稿一覧
          </button>
          <button 
            onclick="switchView('settings')" 
            class="py-4 px-2 border-b-2 font-medium text-sm ${
              appState.currentView === 'settings' 
                ? 'border-amber-500 text-amber-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }"
          >
            <i class="fas fa-cog mr-2"></i>設定
          </button>
        </div>
      </div>
    </nav>
  `;
}

function renderCurrentView() {
  switch (appState.currentView) {
    case 'dashboard':
      return renderDashboard();
    case 'submissions':
      return renderSubmissions();
    case 'settings':
      return renderSettings();
    default:
      return renderDashboard();
  }
}

function renderDashboard() {
  const stats = appState.dashboard?.today_stats;
  const settings = appState.dashboard?.daily_settings;
  const recent = appState.dashboard?.recent_submissions || [];
  
  return `
    <div class="space-y-6">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">本日のエントリー</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">${stats?.total_submissions || 0}</p>
            </div>
            <div class="bg-blue-100 rounded-full p-3">
              <i class="fas fa-camera text-blue-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">写真</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">${stats?.photo_count || 0}</p>
              <p class="text-xs text-gray-500 mt-1">
                選出 ${settings?.photo_adopted_count || 0} / ${settings?.photo_adopt_limit || 0}
              </p>
            </div>
            <div class="bg-green-100 rounded-full p-3">
              <i class="fas fa-image text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">動画</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">${stats?.video_count || 0}</p>
              <p class="text-xs text-gray-500 mt-1">
                選出 ${settings?.video_adopted_count || 0} / ${settings?.video_adopt_limit || 0}
              </p>
            </div>
            <div class="bg-purple-100 rounded-full p-3">
              <i class="fas fa-video text-purple-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">選出済み</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">${stats?.adopted_count || 0}</p>
            </div>
            <div class="bg-amber-100 rounded-full p-3">
              <i class="fas fa-star text-amber-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 営業状態 -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">営業状態</h3>
        <div class="flex items-center space-x-4">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full ${appState.dashboard?.is_business_hours ? 'bg-green-500' : 'bg-gray-400'} mr-2"></div>
            <span class="text-sm font-medium text-gray-700">
              ${appState.dashboard?.is_business_hours ? '営業中' : '営業時間外'}
            </span>
          </div>
          <span class="text-sm text-gray-500">
            ${appState.store?.business_open_time} 〜 ${appState.store?.business_close_time}
          </span>
        </div>
      </div>

      <!-- 最近のエントリー -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">最近のエントリー</h3>
        ${recent.length === 0 ? `
          <p class="text-gray-500 text-center py-8">まだエントリーがありません</p>
        ` : `
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            ${recent.map(sub => `
              <div class="relative group cursor-pointer" onclick="viewSubmission(${sub.id})">
                <img src="${sub.thumbnail_url || sub.file_url}" class="w-full h-32 object-cover rounded-lg" />
                <div class="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  ${sub.total_score || '—'}点
                </div>
                <div class="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  ${sub.table_name}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSubmissions() {
  // 初回ロード
  if (appState.submissions.length === 0 && appState.currentView === 'submissions') {
    loadSubmissions(appState.store.id);
  }
  
  return `
    <div class="space-y-6">
      <!-- フィルター -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex flex-wrap gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">種別</label>
            <select 
              onchange="updateFilter('type', this.value)" 
              class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">すべて</option>
              <option value="photo">写真</option>
              <option value="video">動画</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
            <select 
              onchange="updateFilter('status', this.value)" 
              class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">すべて</option>
              <option value="pending">未選出</option>
              <option value="adopted">選出済み</option>
            </select>
          </div>
        </div>
      </div>

      <!-- エントリー一覧 -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">
          エントリー一覧 (${appState.submissions.length}件)
        </h3>
        
        ${appState.submissions.length === 0 ? `
          <p class="text-gray-500 text-center py-12">該当するエントリーがありません</p>
        ` : `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            ${appState.submissions.map(sub => `
              <div class="border rounded-xl overflow-hidden hover:shadow-lg transition">
                <div class="relative">
                  <img src="${sub.thumbnail_url || sub.file_url}" class="w-full h-48 object-cover" />
                  ${sub.status === 'adopted' ? `
                    <div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                      選出済み
                    </div>
                  ` : ''}
                </div>
                <div class="p-4">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-xs text-gray-500">${sub.table_name}</span>
                    <span class="text-sm font-bold ${getScoreColorClass(sub.total_score)}">
                      ${sub.total_score || '—'}点
                    </span>
                  </div>
                  ${sub.instagram_account ? `
                    <p class="text-xs text-gray-600 mb-3">
                      <i class="fab fa-instagram mr-1"></i>@${sub.instagram_account}
                    </p>
                  ` : ''}
                  ${sub.status === 'pending' ? `
                    <button 
                      onclick="adoptSubmission(${sub.id})" 
                      class="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-sm font-bold rounded-lg transition"
                    >
                      この素材を選出
                    </button>
                  ` : `
                    <div class="w-full py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg text-center">
                      <i class="fas fa-check-circle mr-1"></i>選出済み
                    </div>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="space-y-6">
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-lg font-bold text-gray-900 mb-6">店舗設定</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">店舗名</label>
            <input 
              type="text" 
              value="${appState.store?.name || ''}"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg"
              disabled
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">営業開始時刻</label>
              <input 
                type="text" 
                value="${appState.store?.business_open_time || ''}"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg"
                disabled
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">営業終了時刻</label>
              <input 
                type="text" 
                value="${appState.store?.business_close_time || ''}"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg"
                disabled
              />
            </div>
          </div>
          <p class="text-sm text-gray-500">設定変更機能は開発中です</p>
        </div>
      </div>
    </div>
  `;
}

function switchView(view) {
  appState.currentView = view;
  render();
}

function updateFilter(key, value) {
  appState.filter[key] = value;
  loadSubmissions(appState.store.id);
}

function getScoreColorClass(score) {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
}

// 初期化
init();
