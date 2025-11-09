
document.addEventListener('DOMContentLoaded', () => {
    // --- DEĞİŞKENLER VE ELEMENTLER ---
    const socket = io();

    // Giriş Ekranı
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const playerNameInput = document.getElementById('player-name');
    const tiktokUsernameInput = document.getElementById('tiktok-username');
    const licenseKeyInput = document.getElementById('license-key');
    const loginBtn = document.getElementById('login-btn');
    const loginStatus = document.getElementById('login-status');

    // Oyun Ekranı
    const gameScreen = document.getElementById('game-screen');
    const mapContainer = document.getElementById('map-container');
    const displayPlayerName = document.getElementById('display-player-name');
    const connectionStatus = document.getElementById('connection-status');

    // PK Modu
    const pkControls = document.getElementById('pk-controls');
    const pkRoomIdInput = document.getElementById('pk-room-id');
    const pkTeamSelect = document.getElementById('pk-team-select');
    const pkJoinBtn = document.getElementById('pk-join-btn');
    const pkLeaveBtn = document.getElementById('pk-leave-btn');
    const pkChatBox = document.getElementById('pk-chat-box');

    // Ayarlar
    const bgColorInput = document.getElementById('bg-color');
    const strokeColorInput = document.getElementById('stroke-color');
    const fillColorInput = document.getElementById('fill-color');
    const textColorInput = document.getElementById('text-color');
    const textSizeInput = document.getElementById('text-size');

    // Sıralamalar
    const warriorRankingMenu = document.querySelector('.warrior-ranking-menu');
    const kingdomRankingMenu = document.querySelector('.kingdom-ranking-menu');
    const warriorRankingList = warriorRankingMenu.querySelector('.ranking-list');
    const kingdomRankingList = kingdomRankingMenu.querySelector('.ranking-list');

    let currentRoom = null;
    let currentMode = 'single'; // 'single' or 'pk'
    let myProvinceCount = 0; // Oyuncunun il sayısını takip etmek için eklendi


    // --- SOCKET.IO OLAYLARI ---

    socket.on('connect', () => {
        console.log('Sunucuya başarıyla bağlanıldı!');
    });

    socket.on('disconnect', () => {
        console.log('Sunucu bağlantısı kesildi.');
        connectionStatus.textContent = 'Bağlantı Kesildi';
        connectionStatus.className = 'connection-status disconnected';
    });

    socket.on('license_checked', (data) => {
        if (data.success) {
            loginStatus.textContent = 'Lisans doğrulandı. Oyuna başlanıyor...';
            loginStatus.style.color = 'lightgreen';
            setTimeout(showGameScreen, 1500);
        } else {
            loginStatus.textContent = `Hata: ${data.message}`;
            loginStatus.style.color = 'red';
            loginBtn.disabled = false;
        }
    });

    socket.on('status_update', (data) => {
        connectionStatus.textContent = data.message;
        connectionStatus.className = `connection-status ${data.status}`; // connected, connecting, disconnected
    });

    socket.on('map_update', (provinces) => {
        console.log('Harita güncelleniyor...');
        updateMap(provinces);
        updateWarriorRanking(provinces);
    });

    socket.on('team_update', (teams) => {
        if (!teams) return;
        console.log('Takım verisi geldi:', teams);
        // Burada takım skorlarını gösterecek bir UI elementi eklenebilir.
    });

    socket.on('game_over', (data) => {
        alert(`Oyun Bitti! Kazanan: ${data.winner}`);
        // Global krallık sıralamasını güncelle
        fetchKingdomRanking();
    });

    socket.on('notification', (data) => {
        showNotification(data.message);
    });

    socket.on('pk_chat_message', (data) => {
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `<img src="${data.pic}" style="width: 20px; height: 20px; border-radius: 50%; margin-right: 5px;"> <b>${data.user}:</b> ${data.message}`;
        pkChatBox.appendChild(messageElement);
        pkChatBox.scrollTop = pkChatBox.scrollHeight;
    });


    // --- FONKSİYONLAR ---

    function showGameScreen() {
        loginScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        displayPlayerName.textContent = playerNameInput.value;

        // Haritayı yükle
        fetch('map.svg')
            .then(response => response.text())
            .then(svgData => {
                mapContainer.innerHTML = svgData;
                // Başlangıçta tek kişilik oyun için sunucudan veri iste
                startSinglePlayerGame();
            });

        // Sıralamaları yükle
        fetchWarriorRanking();
        fetchKingdomRanking();
    }

    function startSinglePlayerGame() {
        currentMode = 'single';
        pkLeaveBtn.style.display = 'none';
        pkJoinBtn.style.display = 'block';
        pkControls.style.border = '1px solid #F58231';

        socket.emit('start_single_player', {
            tiktokUser: tiktokUsernameInput.value,
            playerName: playerNameInput.value
        });
    }

    function updateMap(provinces) {
        if (!provinces) return;
        const svg = mapContainer.querySelector('svg');
        if (!svg) return;

        // Önce tüm haritayı temizle (boş il rengine boya)
        svg.querySelectorAll('path').forEach(path => {
            path.style.fill = fillColorInput.value;
        });

        // Gelen verilere göre haritayı boya
        for (const provinceName in provinces) {
            const provinceData = provinces[provinceName];
            const path = svg.querySelector(`path[name="${provinceName}"]`);
            if (path) {
                path.style.fill = provinceData.color;
            }
        }
    }

    function updateWarriorRanking(provinces) {
        if (!provinces) return;

        const provinceCounts = {};
        for (const provinceName in provinces) {
            const owner = provinces[provinceName].owner;
            const pic = provinces[provinceName].pic;
            if (owner && owner !== 'BOŞ') {
                if (!provinceCounts[owner]) {
                    provinceCounts[owner] = { score: 0, pic: pic };
                }
                provinceCounts[owner].score++;
            }
        }

        const myName = playerNameInput.value;
        myProvinceCount = provinceCounts[myName] ? provinceCounts[myName].score : 0;

        const sortedWarriors = Object.entries(provinceCounts).sort((a, b) => b[1].score - a[1].score);

        warriorRankingList.innerHTML = '';
        sortedWarriors.forEach(([name, data]) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span><img src="${data.pic}" class="ranking-pic" onerror="this.style.display='none'">${name}</span>
                <strong>${data.score}</strong>
            `;
            warriorRankingList.appendChild(item);
        });
    }

    function fetchKingdomRanking() {
        fetch('/kingdom-ranking')
            .then(response => response.json())
            .then(ranking => {
                kingdomRankingList.innerHTML = '';
                ranking.forEach(king => {
                    const item = document.createElement('div');
                    item.className = 'ranking-item';
                    item.innerHTML = `
                        <span><img src="${king.pic}" class="ranking-pic" onerror="this.style.display='none'">${king.username}</span>
                        <strong>${king.wins} <span style="color: gold;">👑</span></strong>
                    `;
                    kingdomRankingList.appendChild(item);
                });
            });
    }

    function fetchWarriorRanking() {
        // Bu fonksiyon artık map_update ile tetikleniyor, ancak başlangıçta boş bir liste göstermek için kullanılabilir.
        warriorRankingList.innerHTML = '<span>Harita verisi bekleniyor...</span>';
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'gift-notification';
        notification.textContent = message;
        document.getElementById('gift-notifications').appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // --- EVENT LISTENERS ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        loginStatus.textContent = 'Lisans kontrol ediliyor...';
        loginStatus.style.color = 'lightblue';
        socket.emit('check_license', {
            licenseKey: licenseKeyInput.value,
            tiktok_username: tiktokUsernameInput.value
        });
    });

    pkJoinBtn.addEventListener('click', () => {
        const roomID = pkRoomIdInput.value.trim();
        const team = pkTeamSelect.value;
        if (roomID) {
            currentMode = 'pk';
            currentRoom = roomID;
            pkLeaveBtn.style.display = 'block';
            pkJoinBtn.style.display = 'none';
            pkControls.style.border = `2px solid ${pkTeamSelect.options[pkTeamSelect.selectedIndex].style.color}`;
            pkChatBox.style.display = 'block';
            pkChatBox.innerHTML = ''; // Sohbeti temizle

            socket.emit('join_pk_room', {
                roomID: roomID,
                team: team,
                playerName: playerNameInput.value,
                tiktokUser: tiktokUsernameInput.value
            });
        }
    });

    pkLeaveBtn.addEventListener('click', () => {
        if (currentRoom) {
            socket.emit('leave_pk_room', { roomID: currentRoom });
            currentRoom = null;
            pkChatBox.style.display = 'none';
            // Tek kişilik moda geri dön
            startSinglePlayerGame();
        }
    });

    // Harita Ayarları
    bgColorInput.addEventListener('input', (e) => document.documentElement.style.setProperty('--map-background-color', e.target.value));
    strokeColorInput.addEventListener('input', (e) => document.documentElement.style.setProperty('--map-stroke-color', e.target.value));
    fillColorInput.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--map-fill-color', e.target.value)
        // Haritayı yeniden çizmek için sunucudan tekrar veri istemek iyi bir fikir olabilir
        socket.emit('request_map_update');
    });

    // --- SÜRÜKLENEBİLİR PENCERELER ---
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    makeDraggable(document.getElementById('video-alert-box'), document.querySelector('.video-alert-drag-handle'));

    // Q tuşu ile zafer kazanma
    document.addEventListener('keydown', (e) => {
        if (e.key && e.key.toLowerCase() === 'q' && currentMode === 'single' && myProvinceCount === 81) {
            console.log('Q tuşuna basıldı ve 81 il fethedildi. Zafer ilan ediliyor!');
            socket.emit('claim_victory');
        }
    });
});
