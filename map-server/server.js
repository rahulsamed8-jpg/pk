// --- Harita Sunucusu v2.2 (TAM SÜRÜM VDS - HATA DÜZELTMELİ) ---
// Bu dosya VDS'te (Ubuntu) çalışacak.
// v2.2 GÜNCELLEMELERİ:
// 1. HATA DÜZELTMESİ (Harita Mantığı): İl artık 'Gifter'a (mehmet) veriliyor, Renk 'Takım'a (kırmızı) boyanıyor.
// 2. YENİ ÖZELLİK (Savaşçı Sıralaması): Artık Gifter'ların 'profil resimlerini' (pic) de saklıyor ve 'client.js'e gönderiyor.
// 3. YENİ ÖZELLİK (Takım Kilidi): Bir odaya giren oyuncuya, hangi takımların DOLU olduğunu ('takenTeams') bildirir.

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { io: ClientIO } = require("socket.io-client"); // TikTok (zerody.one) için
const path = require('path');
const fileUpload = require('express-fileupload'); // Video yükleme motoru
const sqlite3 = require('sqlite3').verbose(); // Veritabanı (Krallık Sıralaması) motoru

// --- SUNUCU KURULUMU ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;
const backendUrl = "https://tiktok-chat-reader.zerody.one/";

// --- LİSANS LİSTESİ ---
const VALID_LICENSES = {
    "XXXX-XXXX-XXXX-XXXX": "farabeee",
    "YYYY-YYYY-YYYY-YYYY": "testkullanici",
    "1234-5678-9012-3456": "deneme"
};
// --------------------------------------------------

// --- VERİTABANI KURULUMU (Krallık Sıralaması) ---
const dbPath = './kingdom.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Veritabanı (SQLite) açılamadı:", err.message);
    } else {
        console.log("Veritabanı (SQLite) başarıyla açıldı ('kingdom.db').");
        db.run(`CREATE TABLE IF NOT EXISTS kingdom (
            username TEXT PRIMARY KEY,
            wins INTEGER NOT NULL DEFAULT 0,
            pic TEXT
        )`);
    }
});

// --- YARDIMCI MOTORLAR (Middleware) ---
app.use(express.static('public'));
app.use(fileUpload());
app.use(express.json());

// --- OYUN DEĞİŞKENLERİ ---
const provinceNeighbors = {
    "Adana": ["Mersin", "Hatay", "Osmaniye", "Kahramanmaraş", "Kayseri", "Niğde"],
    "Adıyaman": ["Gaziantep", "Şanlıurfa", "Diyarbakır", "Malatya", "Kahramanmaraş"],
    "Afyonkarahisar": ["Konya", "Isparta", "Denizli", "Uşak", "Kütahya", "Eskişehir"],
    "Ağrı": ["Van", "Bitlis", "Muş", "Erzurum", "Kars", "Iğdır"],
    "Amasya": ["Tokat", "Yozgat", "Çorum", "Samsun"],
    "Ankara": ["Konya", "Aksaray", "Kırşehir", "Kırıkkale", "Çankırı", "Bolu", "Eskişehir"],
    "Antalya": ["Mersin", "Karaman", "Konya", "Isparta", "Burdur", "Muğla"],
    "Artvin": ["Rize", "Erzurum", "Ardahan"],
    "Aydın": ["Muğla", "Denizli", "Manisa", "İzmir"],
    "Balıkesir": ["İzmir", "Manisa", "Kütahya", "Bursa", "Çanakkale"],
    "Bilecik": ["Bursa", "Kütahya", "Eskişehir", "Bolu", "Sakarya"],
    "Bingöl": ["Muş", "Diyarbakır", "Elazığ", "Tunceli", "Erzincan", "Erzurum"],
    "Bitlis": ["Siirt", "Batman", "Muş", "Ağrı", "Van"],
    "Bolu": ["Eskişehir", "Ankara", "Çankırı", "Karabük", "Zonguldak", "Düzce", "Sakarya", "Bilecik"],
    "Burdur": ["Antalya", "Isparta", "Afyonkarahisar", "Denizli", "Muğla"],
    "Bursa": ["Balıkesir", "Kütahya", "Bilecik", "Sakarya", "Kocaeli", "Yalova"],
    "Çanakkale": ["Balıkesir", "Tekirdağ", "Edirne"],
    "Çankırı": ["Ankara", "Kırıkkale", "Çorum", "Kastamonu", "Karabük"],
    "Çorum": ["Yozgat", "Kırıkkale", "Çankırı", "Kastamonu", "Sinop", "Samsun", "Amasya"],
    "Denizli": ["Muğla", "Burdur", "Isparta", "Afyonkarahisar", "Uşak", "Manisa", "Aydın"],
    "Diyarbakır": ["Şanlıurfa", "Mardin", "Batman", "Muş", "Bingöl", "Elazığ", "Malatya", "Adıyaman"],
    "Edirne": ["Çanakkale", "Tekirdağ", "Kırklareli"],
    "Elazığ": ["Diyarbakır", "Malatya", "Erzincan", "Tunceli", "Bingöl"],
    "Erzincan": ["Tunceli", "Elazığ", "Malatya", "Sivas", "Giresun", "Gümüşhane", "Bayburt", "Erzurum", "Bingöl"],
    "Erzurum": ["Bingöl", "Muş", "Ağrı", "Kars", "Ardahan", "Artvin", "Rize", "Bayburt", "Erzincan"],
    "Eskişehir": ["Afyonkarahisar", "Konya", "Ankara", "Bolu", "Bilecik", "Kütahya"],
    "Gaziantep": ["Kilis", "Hatay", "Osmaniye", "Kahramanmaraş", "Adıyaman", "Şanlıurfa"],
    "Giresun": ["Sivas", "Erzincan", "Gümüşhane", "Trabzon", "Ordu"],
    "Gümüşhane": ["Bayburt", "Erzincan", "Giresun", "Trabzon"],
    "Hakkari": ["Şırnak", "Van"],
    "Hatay": ["Kilis", "Gaziantep", "Osmaniye", "Adana"],
    "Isparta": ["Antalya", "Konya", "Afyonkarahisar", "Burdur"],
    "Mersin": ["Antalya", "Karaman", "Konya", "Niğde", "Adana"],
    "İstanbul": ["Tekirdağ", "Kırklareli", "Kocaeli"],
    "İzmir": ["Aydın", "Manisa", "Balıkesir"],
    "Kars": ["Ağrı", "Erzurum", "Ardahan", "Iğdır"],
    "Kastamonu": ["Çankırı", "Çorum", "Sinop", "Bartın", "Karabük"],
    "Kayseri": ["Kahramanmaraş", "Adana", "Niğde", "Nevşehir", "Yozgat", "Sivas"],
    "Kırklareli": ["Edirne", "Tekirdağ", "İstanbul"],
    "Kırşehir": ["Aksaray", "Nevşehir", "Yozgat", "Kırıkkale", "Ankara"],
    "Kocaeli": ["Yalova", "Bursa", "Sakarya", "İstanbul"],
    "Konya": ["Mersin", "Karaman", "Antalya", "Isparta", "Afyonkarahisar", "Eskişehir", "Ankara", "Aksaray", "Niğde"],
    "Kütahya": ["Uşak", "Afyonkarahisar", "Eskişehir", "Bilecik", "Bursa", "Balıkesir", "Manisa"],
    "Malatya": ["Adıyaman", "Diyarbakır", "Elazığ", "Erzincan", "Sivas", "Kahramanmaraş"],
    "Manisa": ["Aydın", "Denizli", "Uşak", "Kütahya", "Balıkesir", "İzmir"],
    "Kahramanmaraş": ["Gaziantep", "Osmaniye", "Adana", "Kayseri", "Sivas", "Malatya", "Adıyaman"],
    "Mardin": ["Şanlıurfa", "Diyarbakır", "Batman", "Siirt", "Şırnak"],
    "Muğla": ["Antalya", "Burdur", "Denizli", "Aydın"],
    "Muş": ["Diyarbakır", "Batman", "Bitlis", "Ağrı", "Erzurum", "Bingöl"],
    "Nevşehir": ["Niğde", "Aksaray", "Kırşehir", "Yozgat", "Kayseri"],
    "Niğde": ["Mersin", "Konya", "Aksaray", "Nevşehir", "Kayseri", "Adana"],
    "Ordu": ["Tokat", "Sivas", "Giresun", "Samsun"],
    "Rize": ["Artvin", "Erzurum", "Bayburt", "Trabzon"],
    "Sakarya": ["Kocaeli", "Bursa", "Bilecik", "Bolu", "Düzce"],
    "Samsun": ["Ordu", "Tokat", "Amasya", "Çorum", "Sinop"],
    "Siirt": ["Şırnak", "Mardin", "Batman", "Bitlis", "Van"],
    "Sinop": ["Samsun", "Çorum", "Kastamonu"],
    "Sivas": ["Kahramanmaraş", "Malatya", "Erzincan", "Giresun", "Ordu", "Tokat", "Yozgat", "Kayseri"],
    "Tekirdağ": ["İstanbul", "Çanakkale", "Edirne", "Kırklareli"],
    "Tokat": ["Sivas", "Yozgat", "Amasya", "Samsun", "Ordu"],
    "Trabzon": ["Giresun", "Gümüşhane", "Bayburt", "Rize"],
    "Tunceli": ["Elazığ", "Erzincan", "Bingöl"],
    "Şanlıurfa": ["Mardin", "Diyarbakır", "Adıyaman", "Gaziantep"],
    "Uşak": ["Denizli", "Afyonkarahisar", "Kütahya", "Manisa"],
    "Van": ["Hakkari", "Şırnak", "Siirt", "Bitlis", "Ağrı"],
    "Yozgat": ["Kayseri", "Nevşehir", "Kırşehir", "Kırıkkale", "Amasya", "Çorum", "Tokat", "Sivas"],
    "Zonguldak": ["Düzce", "Bolu", "Karabük", "Bartın"],
    "Aksaray": ["Konya", "Niğde", "Nevşehir", "Kırşehir", "Ankara"],
    "Bayburt": ["Gümüşhane", "Erzincan", "Erzurum", "Trabzon"],
    "Karaman": ["Mersin", "Konya", "Antalya"],
    "Kırıkkale": ["Kırşehir", "Ankara", "Çankırı", "Çorum", "Yozgat"],
    "Batman": ["Mardin", "Diyarbakır", "Muş", "Bitlis", "Siirt"],
    "Şırnak": ["Mardin", "Siirt", "Van", "Hakkari"],
    "Bartın": ["Zonguldak", "Karabük", "Kastamonu"],
    "Ardahan": ["Artvin", "Erzurum", "Kars"],
    "Iğdır": ["Ağrı", "Kars"],
    "Yalova": ["Bursa", "Kocaeli", "İstanbul"],
    "Karabük": ["Çankırı", "Bolu", "Zonguldak", "Bartın", "Kastamonu"],
    "Kilis": ["Gaziantep", "Hatay"],
    "Osmaniye": ["Hatay", "Gaziantep", "Kahramanmaraş", "Adana"],
    "Düzce": ["Sakarya", "Bolu", "Zonguldak"]
};
// Hediye Ayarları (Kalp=10)
const PROVINCE_GIFTS = {
    'gül': { provinces: 1 }, 'rose': { provinces: 1 },
    'beni sev': { provinces: 5 }, 'heart me': { provinces: 5 },
    'finger heart': { provinces: 5 },
    'kalp': { provinces: 10 }, 'heart': { provinces: 10 },
    'rosa': { provinces: 10 },
    'parfüm': { provinces: 24 }, 'perfume': { provinces: 24 },
    'donat': { provinces: 36 }, 'donut': { provinces: 36 },
    'çay': { provinces: 81 }, 'tea': { provinces: 81 }
};
// Beğeni Ayarları (150=1)
const LIKE_REWARD_THRESHOLD = 150;
const PROVINCES_PER_LIKE_REWARD = 1;

// v2.2: PK Takım Renkleri
const TEAM_COLORS = {
    "kirmizi": "#E6194B", // Kırmızı
    "mavi": "#4363D8", // Mavi
    "yesil": "#3CB44B", // Yeşil
    "sari": "#FFE119" // Sarı
};
// v2.2: Savaşçı Sıralaması için Hediye Atanların Profil Resimlerini (pic) sakla
// (Bu, 'provinceCounts'un (Savaşçı Sıralaması) yerini alacak)
const gifterProfiles = {}; // { 'mehmet': { 'pic': 'url...' } }

let gameRooms = {}; // PK Modu odaları
let singlePlayerGames = {}; // Tek Kişilik oyunlar (socket.id'ye göre)
let playerColors = {}; // Oyuncu renkleri (Global - Sadece Tek Kişilik Mod için)

// 81 ilin boş durumunu oluşturan fonksiyon
function createInitialProvinces() {
    let provinces = {};
    Object.keys(provinceNeighbors).forEach(name => {
        provinces[name] = {
            owner: null, // v2.2: Hediye Atan ('mehmet')
            color: null  // v2.2: Takım Rengi ('#E6194B')
        };
    });
    return provinces;
}
// Tek Kişilik Mod için rastgele renk atama (Hediye Atan 'mehmet' için)
function getOrAssignColor(gifterName) {
    if (!playerColors[gifterName]) {
        const colors = ['#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#FFE119', '#42D4F4', '#F032E6', '#FABEBE', '#008080'];
        const assignedColors = Object.values(playerColors);
        let availableColors = colors.filter(c => !assignedColors.includes(c));
        if (availableColors.length > 0) {
             playerColors[gifterName] = availableColors[Math.floor(Math.random() * availableColors.length)];
        } else {
             playerColors[gifterName] = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
        }
    }
    return playerColors[gifterName];
}

// --- API Rotaları (PHP YERİNE GEÇER) ---
// (Lisans, Krallık, Video Yükleme - v2.1 ile AYNI)
app.get('/get_ranking', (req, res) => {
    db.all("SELECT username, wins, pic FROM kingdom ORDER BY wins DESC LIMIT 100", [], (err, rows) => {
        if (err) {
            console.error("Krallık sıralaması (DB) okunamadı:", err.message);
            res.json({ success: false, message: "Veritabanı hatası." });
        } else {
            const ranking = {};
            rows.forEach(row => {
                ranking[row.username] = {
                    wins: row.wins,
                    pic: row.pic
                };
            });
            res.json({ success: true, ranking: ranking });
        }
    });
});
app.post('/update_victory', (req, res) => {
    const { username, pic } = req.body;
    if (!username) {
        return res.json({ success: false, message: "Kullanıcı adı eksik." });
    }
    const sql = `
        INSERT INTO kingdom (username, wins, pic)
        VALUES (?, 1, ?)
        ON CONFLICT(username)
        DO UPDATE SET wins = wins + 1, pic = excluded.pic
    `;
    db.run(sql, [username, pic], function(err) {
        if (err) {
            console.error("Zafer (DB) kaydedilemedi:", err.message);
            return res.json({ success: false, message: "Veritabanı hatası." });
        }
        console.log(`Krallık (DB): ${username} için zafer kaydedildi.`);
        res.json({ success: true });
    });
});
app.post('/upload_video', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: false, message: 'Dosya yüklenmedi.' });
    }
    const videoFile = req.files.video;
    const uploadPath = path.join(__dirname, 'public', 'uploads', videoFile.name);
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!require('fs').existsSync(uploadDir)){
        require('fs').mkdirSync(uploadDir, { recursive: true });
    }
    videoFile.mv(uploadPath, (err) => {
        if (err) {
            console.error("Video yüklenemedi:", err);
            return res.status(500).json({ success: false, message: err });
        }
        const fileUrl = `/uploads/${videoFile.name}`;
        console.log(`Video yüklendi: ${fileUrl}`);
        res.json({ success: true, message: 'Video yüklendi!', url: fileUrl });
    });
});


// --- SOCKET.IO (Oyun Bağlantısı) YÖNETİMİ ---
io.on('connection', (socket) => {
    console.log(`Bir oyuncu bağlandı (Socket ID): ${socket.id}`);

    socket.on('check_license', (data) => {
        const { licenseKey, tiktok_username } = data;
        if (VALID_LICENSES[licenseKey]) {
            console.log(`LİSANS BAŞARILI: ${tiktok_username} (${licenseKey})`);
            socket.emit('license_checked', { success: true, message: "Lisans doğrulandı." });
        } else {
            console.log(`LİSANS BAŞARISIZ: ${tiktok_username} (${licenseKey})`);
            socket.emit('license_checked', { success: false, message: "Geçersiz lisans anahtarı." });
        }
    });

    // Oyuncu Tek Kişilik Oyuna (cPanel'deki) bağlandığında
    socket.on('start_single_player', (data) => {
        const tiktokUser = data.tiktokUser;
        if (!tiktokUser) return;

        console.log(`TEK KİŞİLİK OYUN: ${socket.id} (${tiktokUser}) için başlatılıyor...`);

        // Bu oyuncu için yeni bir oyun durumu oluştur
        const game = {
            socketId: socket.id,
            provinces: createInitialProvinces(),
            provinceCounts: {}, // Savaşçı Sıralaması (Hediye Atanlar)
            likeCountSinceLastReward: 0,
            tiktokUser: tiktokUser,
            connection: null
        };
        singlePlayerGames[socket.id] = game;

        // v2.2: Savaşçı Sıralaması (boş) ve Harita (boş) gönder
        socket.emit('map_update', {
            provinces: game.provinces,
            provinceCounts: game.provinceCounts
        });

        let connection = ClientIO(backendUrl);
        game.connection = connection;

        connection.on('connect', () => {
            console.log(`TEK KİŞİLİK (${tiktokUser}): 'zerody.one' aktarıcısına BAŞARIYLA bağlandı!`);
            connection.emit('setUniqueId', tiktokUser, {
                enableExtendedGiftInfo: true
            });
        });
        connection.on('tiktokConnected', (state) => {
            console.log(`TEK KİŞİLİK (${tiktokUser}): ${tiktokUser} yayınına BAŞARIYLA bağlandı!`);
            socket.emit('tiktok_connected');
        });
        connection.on('tiktokDisconnected', (reason) => {
            let reasonText = reason || 'Bilinmeyen hata';
            console.log(`TEK KİŞİLİK (${tiktokUser}): Bağlantı kesildi: ${reasonText}`);
            socket.emit('tiktok_disconnected', reasonText);
        });

        // --- HEDİYE (GIFT) OLAYI (TEK KİŞİLİK) ---
        connection.on('gift', (data) => {
            const viewerName = data.uniqueId; // Hediyeyi atan kişi
            const viewerPic = data.profilePictureUrl; // v2.2: Resmini al

            if (data.giftType === 1 && !data.repeatEnd) return;
            const giftName = data.giftName.toLowerCase();
            const giftConfig = PROVINCE_GIFTS[giftName];

            if (giftConfig) {
                const totalProvinces = giftConfig.provinces * data.repeatCount;
                console.log(`TEK KİŞİLİK (${tiktokUser}): ${viewerName} -> ${giftName} (x${data.repeatCount}) = ${totalProvinces} il`);

                for(let i=0; i < totalProvinces; i++) {
                    // v2.2 DÜZELTMESİ:
                    // İli 'viewerName'e (mehmet) ver
                    // Savaşçı Sıralamasını 'viewerName' (mehmet) için say
                    // Rengi 'viewerName' (mehmet) için rastgele ata
                    // Profil resmini (viewerPic) kaydet
                    giveProvince(game, viewerName, viewerPic, null);
                }

                // v2.2: Hem haritayı HEM de güncel Savaşçı Sıralamasını gönder
                socket.emit('map_update', {
                    provinces: game.provinces,
                    provinceCounts: game.provinceCounts
                });
                socket.emit('chat_message', `🎁 ${viewerName}, ${totalProvinces} il kazandı! (${giftName})`);
            }
        });

        // --- BEĞENİ (LIKE) OLAYI (TEK KİŞİLİK) ---
        connection.on('like', (data) => {
            const viewerName = data.uniqueId; // Beğeniyi atan kişi
            const viewerPic = data.profilePictureUrl; // v2.2: Resmini al
            const likeCount = data.likeCount || 0;
            if (likeCount <= 0) return;
            // 81 il kuralı (Savaşçı Sıralamasına göre)
            if (game.provinceCounts[viewerName] && game.provinceCounts[viewerName].score >= 81) return;

            game.likeCountSinceLastReward += likeCount;

            if (game.likeCountSinceLastReward >= LIKE_REWARD_THRESHOLD) {
                const rewardsToGive = Math.floor(game.likeCountSinceLastReward / LIKE_REWARD_THRESHOLD);
                const totalProvincesFromLike = rewardsToGive * PROVINCES_PER_LIKE_REWARD;

                console.log(`TEK KİŞİLİK (${tiktokUser}): EŞİK AŞILDI: ${viewerName} -> ${totalProvincesFromLike} il (beğeni)`);

                for(let i=0; i < totalProvincesFromLike; i++) {
                    // v2.2 DÜZELTMESİ:
                    // İli 'viewerName'e (mehmet) ver
                    // Savaşçı Sıralamasını 'viewerName' (mehmet) için say
                    // Rengi 'viewerName' (mehmet) için rastgele ata
                    // Profil resmini (viewerPic) kaydet
                    giveProvince(game, viewerName, viewerPic, null);
                }

                // v2.2: Hem haritayı HEM de güncel Savaşçı Sıralamasını gönder
                socket.emit('map_update', {
                    provinces: game.provinces,
                    provinceCounts: game.provinceCounts
                });
                socket.emit('chat_message', `👍 ${viewerName}, ${totalProvincesFromLike} il kazandı! (${rewardsToGive * LIKE_REWARD_THRESHOLD} Beğeni)`);

                game.likeCountSinceLastReward %= LIKE_REWARD_THRESHOLD;
            }
        });
    }); // 'start_single_player' bitti

    // ---------------------------------------------------------------------------------

    // Oyuncu PK Moduna katılmak istediğinde
    socket.on('join_pk_room', (data) => {
        const roomID = data.roomID;
        const tiktokUser = data.tiktokUser;
        const team = data.team; // v2.2: 'kirmizi', 'mavi' vb.

        if (!roomID || !tiktokUser || !team) {
            console.error("PK Katılma hatası: Oda, Kullanıcı veya Takım eksik.");
            return;
        }

        // Tek kişilik oyunu (varsa) sonlandır
        if (singlePlayerGames[socket.id]) {
            console.log(`TEK KİŞİLİK OYUN: ${socket.id} (${singlePlayerGames[socket.id].tiktokUser}) durduruluyor.`);
            singlePlayerGames[socket.id].connection.disconnect();
            delete singlePlayerGames[socket.id];
        }

        console.log(`PK MODU: ${socket.id} (${tiktokUser}), ${roomID} odasına (${team}) olarak katılıyor...`);
        socket.join(roomID);

        // --- ODA YÖNETİMİ (v2.2) ---
        if (!gameRooms[roomID]) {
            console.log(`PK MODU: Yeni oda ${roomID} için oyun durumu oluşturuluyor.`);
            gameRooms[roomID] = {
                roomID: roomID,
                provinces: createInitialProvinces(),
                provinceCounts: {}, // Savaşçı Sıralaması (HEDİYE ATANLARI sayar)
                likeCountSinceLastReward: {}, // Yayıncılara (PK oyuncularına) göre sayar
                players: {} // Odaya bağlı oyuncular ve TikTok bağlantıları
            };
        }
        const roomState = gameRooms[roomID];

        // --- v2.2: TAKIM KİLİDİ KONTROLÜ ---
        const takenTeams = Object.values(roomState.players).map(p => p.team);
        if (takenTeams.includes(team)) {
            // Bu takım zaten bu odada başka bir yayıncı tarafından alınmış
            console.warn(`PK MODU: ${tiktokUser}, ${team} takımını almaya çalıştı ama DOLU.`);
            socket.emit('chat_message', `Sunucu: HATA! ${team} takımı zaten dolu. Lütfen başka bir takım seçin.`);
            // Oyuncuyu odadan at (veya sadece hata gönder)
            socket.leave(roomID);
            // Tek Kişilik Oyuna Geri Dön (v2.2 İyileştirmesi)
            // (Şimdilik sadece hata veriyoruz, client.js (v2.2) bunu 'PK'dan Ayrıl' butonuyla çözecek)
            return;
        }
        // --- v2.2: TAKIM KİLİDİ KONTROLÜ SONU ---

        // Oyuncuya mevcut PK harita durumunu (Savaşçı Sıralaması dahil) gönder
        socket.emit('map_update', {
            provinces: roomState.provinces,
            provinceCounts: roomState.provinceCounts
        });
        io.to(roomID).emit('chat_message', `Sunucu: ${tiktokUser}, ${team} takımına katıldı!`);

        // v2.2: Odadaki herkese hangi takımların DOLU olduğunu bildir (Takım Kilidi için)
        const updatedTakenTeams = [...takenTeams, team];
        io.to(roomID).emit('team_update', updatedTakenTeams);


        // --- TİKTOK BAĞLANTI YÖNETİMİ (PK v2.2) ---
        if (!roomState.players[tiktokUser]) {
            console.log(`PK MODU: ${roomID} odası için ${tiktokUser} yayınına bağlanılıyor...`);

            let connection = ClientIO(backendUrl);
            roomState.players[tiktokUser] = {
                socketId: socket.id,
                connection: connection,
                team: team // v2.2: Oyuncunun takımını kaydet
            };
            roomState.likeCountSinceLastReward[tiktokUser] = 0;

            // --- BU OYUNCUYA AİT TİKTOK DİNLEYİCİLERİ ---
            connection.on('connect', () => {
                console.log(`PK MODU (${tiktokUser}): 'zerody.one' aktarıcısına BAŞARIYLA bağlandı!`);
                connection.emit('setUniqueId', tiktokUser, {
                    enableExtendedGiftInfo: true
                });
            });

            connection.on('tiktokConnected', (state) => {
                console.log(`PK MODU (${tiktokUser}): ${tiktokUser} yayınına BAŞARIYLA bağlandı!`);
                io.to(roomID).emit('chat_message', `Sunucu: ${tiktokUser} (${team}) yayınına başarıyla bağlandı!`);
            });

            connection.on('tiktokDisconnected', (reason) => {
                let reasonText = reason || 'Bilinmeyen hata';
                console.log(`PK MODU (${tiktokUser}): Bağlantı kesildi: ${reasonText}`);
                io.to(roomID).emit('chat_message', `Sunucu: ${tiktokUser} yayınının bağlantısı kesildi. ${reasonText}`);

                // v2.2: Oyuncu bağlantısı kesilirse, takımı TEKRAR SEÇİLEBİLİR yap
                if(roomState && roomState.players[tiktokUser]) {
                    const disconnectedTeam = roomState.players[tiktokUser].team;
                    roomState.players[tiktokUser].connection.disconnect();
                    delete roomState.players[tiktokUser];

                    // Odadaki herkese hangi takımların DOLU olduğunu (güncel listeyi) bildir
                    const remainingTakenTeams = Object.values(roomState.players).map(p => p.team);
                    io.to(roomID).emit('team_update', remainingTakenTeams);
                }
            });

            // --- HEDİYE (GIFT) OLAYI (PK MODU v2.2) ---
            connection.on('gift', (data) => {
                const viewerName = data.uniqueId; // Hediyeyi atan kişi ('mehmet')
                const viewerPic = data.profilePictureUrl; // v2.2: 'mehmet'in resmi

                if (data.giftType === 1 && !data.repeatEnd) return;
                const giftName = data.giftName.toLowerCase();
                const giftConfig = PROVINCE_GIFTS[giftName];

                if (giftConfig && roomState.players[tiktokUser]) {
                    const totalProvinces = giftConfig.provinces * data.repeatCount;
                    const playerTeam = roomState.players[tiktokUser].team; // Yayıncının takımı ('kirmizi')
                    const teamColor = TEAM_COLORS[playerTeam]; // Takımın rengi ('#E6194B')

                    console.log(`PK MODU (${roomID}): ${viewerName} -> ${giftName} (x${data.repeatCount}) = ${totalProvinces} il (Hedef Takım: ${playerTeam})`);

                    for(let i=0; i < totalProvinces; i++) {
                        // v2.2 GÜNCELLEMESİ (HATA DÜZELTMESİ):
                        // İli, HEDİYE ATANA (viewerName) ver.
                        // Savaşçı Sıralamasını (provinceCounts) HEDİYE ATANA (viewerName) ver.
                        // Rengi, TAKIM RENGİ (teamColor) yap.
                        // Profil resmini (viewerPic) kaydet
                        giveProvince(roomState, viewerName, viewerPic, teamColor);
                    }

                    // v2.2: Hem haritayı HEM de güncel Savaşçı Sıralamasını gönder
                    io.to(roomID).emit('map_update', {
                        provinces: roomState.provinces,
                        provinceCounts: roomState.provinceCounts
                    });
                    io.to(roomID).emit('chat_message', `🎁 ${viewerName}, ${playerTeam} takımına ${totalProvinces} il kazandırdı! (${giftName})`);
                }
            });

            // --- BEĞENİ (LIKE) OLAYI (PK MODU v2.2) ---
            connection.on('like', (data) => {
                const viewerName = data.uniqueId; // Beğeniyi atan kişi
                const viewerPic = data.profilePictureUrl; // v2.2: 'mehmet'in resmi
                const likeCount = data.likeCount || 0;

                if (!roomState || likeCount <= 0 || !roomState.players[tiktokUser]) return;

                const playerTeam = roomState.players[tiktokUser].team; // Yayıncının takımı ('kirmizi')
                const teamColor = TEAM_COLORS[playerTeam]; // Takımın rengi ('#E6194B')

                // 81 il kuralı (Hediye atana (viewerName) göre)
                if (roomState.provinceCounts[viewerName] && roomState.provinceCounts[viewerName].score >= 81) return;

                if (typeof roomState.likeCountSinceLastReward[tiktokUser] !== 'number') {
                     roomState.likeCountSinceLastReward[tiktokUser] = 0;
                }
                roomState.likeCountSinceLastReward[tiktokUser] += likeCount;

                if (roomState.likeCountSinceLastReward[tiktokUser] >= LIKE_REWARD_THRESHOLD) {
                    const rewardsToGive = Math.floor(roomState.likeCountSinceLastReward[tiktokUser] / LIKE_REWARD_THRESHOLD);
                    const totalProvincesFromLike = rewardsToGive * PROVINCES_PER_LIKE_REWARD;

                    console.log(`PK MODU (${roomID}): EŞİK AŞILDI: ${viewerName} -> ${totalProvincesFromLike} il (beğeni) (Hedef Takım: ${playerTeam})`);

                    for(let i=0; i < totalProvincesFromLike; i++) {
                        // v2.2 GÜNCELLEMESİ (HATA DÜZELTMESİ):
                        // İli, BEĞENİ ATANA (viewerName) ver.
                        // Savaşçı Sıralamasını (provinceCounts) BEĞENİ ATANA (viewerName) ver.
                        // Rengi, TAKIM RENGİ (teamColor) yap.
                        // Profil resmini (viewerPic) kaydet
                        giveProvince(roomState, viewerName, viewerPic, teamColor);
                    }

                    // v2.2: Hem haritayı HEM de güncel Savaşçı Sıralamasını gönder
                    io.to(roomID).emit('map_update', {
                        provinces: roomState.provinces,
                        provinceCounts: roomState.provinceCounts
                    });
                    io.to(roomID).emit('chat_message', `👍 ${viewerName}, ${playerTeam} takımına ${totalProvincesFromLike} il kazandırdı! (${rewardsToGive * LIKE_REWARD_THRESHOLD} Beğeni)`);

                    roomState.likeCountSinceLastReward[tiktokUser] %= LIKE_REWARD_THRESHOLD;
                }
            });

        } else {
            // Bu oyuncu (yayıncı) zaten izleniyordu, SADECE bu socket'i odaya ekle
            console.log(`PK MODU: ${roomID} odasındaki mevcut oyuna ${socket.id} (${tiktokUser}) yeniden katıldı.`);
            // (v2.2: Birden fazla istemci (tarayıcı) aynı yayını izleyebilir, sorun değil)
        }
    }); // 'join_pk_room' bitti

    // ---------------------------------------------------------------------------------

    // Oyuncu bağlantıyı kestiğinde (tarayıcıyı kapattığında)
    socket.on('disconnect', () => {
        console.log(`Oyuncu ayrıldı: ${socket.id}`);

        // Tek Kişilik oyundaysa, o oyunu ve TikTok bağlantısını sonlandır
        if (singlePlayerGames[socket.id]) {
            console.log(`TEK KİŞİLİK OYUN: ${socket.id} (${singlePlayerGames[socket.id].tiktokUser}) sonlandırılıyor.`);
            singlePlayerGames[socket.id].connection.disconnect();
            delete singlePlayerGames[socket.id];
        }

        // v2.2: PK Modundaysa, o oyuncuyu (YAYINCIYI) odadan ve TikTok bağlantısından çıkar
        // (Bu, 'tiktokDisconnected' olayından farklıdır, bu tarayıcıyı kapatmaktır)
        let roomIDToRemove = null;
        let teamToRemove = null;
        let tiktokUserToRemove = null;

        for (const [roomID, roomState] of Object.entries(gameRooms)) {
            for (const [tiktokUser, player] of Object.entries(roomState.players)) {
                if (player.socketId === socket.id) {
                    // Bu socket odaya bağlı bir YAYINCIYDI
                    console.log(`PK MODU: ${tiktokUser} (${player.team}) yayını, ${roomID} odasından ayrılıyor.`);
                    player.connection.disconnect();
                    delete roomState.players[tiktokUser];

                    roomIDToRemove = roomID;
                    teamToRemove = player.team;
                    tiktokUserToRemove = tiktokUser;
                    break;
                }
            }
        }
        // v2.2: Odadaki diğer oyunculara Takım Kilidi listesini güncelle
        if (roomIDToRemove && teamToRemove) {
            io.to(roomIDToRemove).emit('chat_message', `Sunucu: ${tiktokUserToRemove} (${teamToRemove}) takımı oyundan ayrıldı.`);
            const remainingTakenTeams = Object.values(gameRooms[roomIDToRemove].players).map(p => p.team);
            io.to(roomIDToRemove).emit('team_update', remainingTakenTeams);
        }
    });

    // YENİ: Q tuşu ile zafer kazanma
    socket.on('claim_victory', () => {
        const game = singlePlayerGames[socket.id];
        if (!game) {
            console.log(`claim_victory: Geçersiz oyun durumu (socket ID: ${socket.id})`);
            return;
        }

        const provinceCounts = game.provinceCounts;
        let winnerName = null;
        let winnerPic = null;

        // 81 ili olan oyuncuyu bul
        for (const name in provinceCounts) {
            if (provinceCounts[name].score === 81) {
                winnerName = name;
                winnerPic = provinceCounts[name].pic;
                break;
            }
        }

        if (winnerName) {
            console.log(`${winnerName} OYUNU KAZANDI (Q tuşu ile manuel olarak)`);

            // Veritabanına zaferi kaydet
            db.run(`INSERT INTO kingdom (username, wins, pic) VALUES (?, 1, ?)
                    ON CONFLICT(username) DO UPDATE SET wins = wins + 1, pic = excluded.pic`,
                    [winnerName, winnerPic]);

            // Zafer mesajını client'a gönder
            io.to(game.socketId).emit('game_over', { winner: winnerName });

            // Oyunu sıfırla
            game.provinces = createInitialProvinces();
            game.provinceCounts = {};
            game.likeCountSinceLastReward = 0;

            // Haritayı temizlemesi için client'a güncelleme gönder
            io.to(game.socketId).emit('map_update', {
                provinces: game.provinces,
                provinceCounts: game.provinceCounts
            });

        } else {
            console.log(`claim_victory: Zafer ilanı başarısız. 81 ile sahip oyuncu bulunamadı. (Socket ID: ${socket.id})`);
        }
    });
});

// --- OYUN MANTIĞI (SUNUCUDA ÇALIŞIR) (v2.2 GÜNCELLENDİ) ---
// (Bu fonksiyon hem Tek Kişilik hem de PK Modu için ortak kullanılır)
// gameState: 'singlePlayerGames[socket.id]' VEYA 'gameRooms[roomID]'
// gifterName: İli alacak olan (Savaşçı Sıralamasına eklenecek olan) ('mehmet')
// gifterPic: Hediye atanın profil resmi ('mehmet'in resmi)
// teamColor: (PK Modu) İlin alacağı renk (örn: '#E6194B') (Tek Kişilik Modda 'null')
function giveProvince(gameState, gifterName, gifterPic, teamColor = null) {
    const provinces = gameState.provinces;
    let targetProvinceName = null;

    // v2.2 GÜNCELLEMESİ (HATA DÜZELTMESİ):
    // İli, HEDİYE ATANA (gifterName) göre ara, TAKIMA ('kirmizi') göre değil!
    const ownedProvinces = Object.keys(provinces).filter(name => provinces[name].owner === gifterName);

    // 2. Komşu ve boş olan illeri ara
    if (ownedProvinces.length > 0) {
        const allNeighbors = ownedProvinces.flatMap(pName => provinceNeighbors[pName] || []);
        const uniqueNeighbors = [...new Set(allNeighbors)];
        const adjacentAndAvailable = uniqueNeighbors.filter(name =>
            provinces[name] && provinces[name].owner === null
        );
        if (adjacentAndAvailable.length > 0) {
            targetProvinceName = adjacentAndAvailable[Math.floor(Math.random() * adjacentAndAvailable.length)];
        }
    }

    // 3. Komşu boş il yoksa, haritadaki herhangi bir boş ili hedefle
    if (!targetProvinceName) {
        const allAvailable = Object.keys(provinces).filter(name => provinces[name].owner === null);
        if (allAvailable.length > 0) {
            targetProvinceName = allAvailable[Math.floor(Math.random() * allAvailable.length)];
        }
    }

    // 4. Hiç boş il yoksa, düşman illerini hedefle (komşu düşman öncelikli)
    if (!targetProvinceName) {
        const allNeighbors = ownedProvinces.flatMap(pName => provinceNeighbors[pName] || []);
        const uniqueNeighbors = [...new Set(allNeighbors)];
        const adjacentEnemies = uniqueNeighbors.filter(name =>
            provinces[name] && provinces[name].owner !== null && provinces[name].owner !== gifterName
        );
        if (adjacentEnemies.length > 0) {
            targetProvinceName = adjacentEnemies[Math.floor(Math.random() * adjacentEnemies.length)];
        } else {
            // Komşu düşman yoksa, rastgele düşman
            const allEnemies = Object.keys(provinces).filter(name =>
                provinces[name].owner !== null && provinces[name].owner !== gifterName
            );
            if (allEnemies.length > 0) {
                targetProvinceName = allEnemies[Math.floor(Math.random() * allEnemies.length)];
            }
        }
    }

    // 5. Fethedilecek il bulundu
    if (targetProvinceName) {
        const province = provinces[targetProvinceName];
        const previousOwner = province.owner;

        // Savaşçı Sıralamasını (provinceCounts) güncelle
        const provinceCounts = gameState.provinceCounts;

        // v2.2: Savaşçı Sıralaması artık { score: 0, pic: 'url' } objesi tutuyor
        if (previousOwner && provinceCounts[previousOwner]) {
            provinceCounts[previousOwner].score--;
            if (provinceCounts[previousOwner].score <= 0) {
                delete provinceCounts[previousOwner];
            }
        }
        if (!provinceCounts[gifterName]) {
            provinceCounts[gifterName] = { score: 0, pic: gifterPic };
        }
        provinceCounts[gifterName].score++;
        provinceCounts[gifterName].pic = gifterPic; // Resmini güncelle

        // v2.2: Gifter profil resimlerini globalde de sakla (Krallık için)
        if (!gifterProfiles[gifterName] || !gifterProfiles[gifterName].pic) {
            gifterProfiles[gifterName] = { pic: gifterPic };
        }

        // v2.2 HATA DÜZELTMESİ:
        // İlin SAHİBİ 'gifterName' (mehmet) olmalı
        // İlin RENGİ 'teamColor' (kırmızı) VEYA 'gifterName'in rastgele rengi olmalı
        province.owner = gifterName;
        province.color = teamColor || getOrAssignColor(gifterName); // (PK'de Takım Rengi, Tek Kişilikte Rastgele Renk)

        // 81 il kontrolü (Hediye atanın (gifterName) 81 ili oldu mu?)
        const ownerProvinceTotal = provinceCounts[gifterName].score;

        if (ownerProvinceTotal === 81) {
            // Eskiden burada oyun otomatik bitiyordu. Şimdi sadece logluyoruz.
            // Zafer, client'tan gelen 'claim_victory' olayı ile tetiklenecek.
            console.log(`${gifterName} 81 ile ulaştı. Zafer ilanı için 'Q' tuşuna basması bekleniyor.`);
        }
    }
}


// --- Sunucuyu Başlat ---
server.listen(PORT, () => {
    console.log(`Harita sunucusu v2.2 (HATA DÜZELTMELİ) http://localhost:${PORT} adresinde çalışmaya başladı`);
    console.log(`Erişim Adresi: http://2.59.119.131:${PORT}`);
});
