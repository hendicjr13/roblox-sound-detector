let currentSoundsData = [];

async function detectSounds() {
    const userId = document.getElementById('userIdInput').value.trim();
    const btn = document.getElementById('detectBtn');
    const status = document.getElementById('status');
    const resultArea = document.getElementById('resultArea');

    if (!userId) {
        alert('User ID gak boleh kosong bro!');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Scanning...';
    status.innerText = '⏳ Sedang scanning & mengecek status audio... Mohon tunggu.';
    status.classList.remove('hidden');
    status.className = 'text-center text-yellow-400 mb-4 text-sm';
    resultArea.classList.add('hidden');

    try {
        const response = await fetch('/api/detect-sounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Terjadi kesalahan pada server');
        }

        currentSoundsData = data.sounds;
        document.getElementById('totalSounds').innerText = data.totalSounds;

        // Reset filter/search tiap scan baru
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('sortOrder').value = 'newest';

        renderTable();

        status.innerText = `✅ Selesai! Berhasil mendeteksi ${data.totalSounds} sound.`;
        status.className = 'text-center text-green-400 mb-4 text-sm';
        resultArea.classList.remove('hidden');

    } catch (error) {
        status.innerText = ` Error: ${error.message}`;
        status.className = 'text-center text-red-400 mb-4 text-sm';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Detect';
    }
}

function getStatusBadge(statusValue) {
    if (statusValue === 'ACTIVE') {
        return `<span class="px-2.5 py-1 bg-green-900/60 text-green-300 rounded-full text-xs font-semibold">✅ Active</span>`;
    } else if (statusValue === 'DELETED / COPYRIGHT (moderated)') {
        return `<span class="px-2.5 py-1 bg-red-900/60 text-red-300 rounded-full text-xs font-semibold">❌ Copyright</span>`;
    } else if (statusValue === 'DELETED / COPYRIGHT') {
        return `<span class="px-2.5 py-1 bg-red-900/60 text-red-300 rounded-full text-xs font-semibold">❌ Deleted</span>`;
    } else {
        return `<span class="px-2.5 py-1 bg-gray-700/60 text-gray-300 rounded-full text-xs font-semibold">❔ Unknown</span>`;
    }
}

function renderTable() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const sortOrder = document.getElementById('sortOrder').value;

    let filtered = currentSoundsData.filter(sound => {
        const matchesSearch = !searchTerm ||
            sound.name.toLowerCase().includes(searchTerm) ||
            String(sound.assetId).includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || sound.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Data dari server udah di-sort "newest" secara default (berdasarkan Created / Asset ID).
    // Kalau user pilih "oldest", tinggal dibalik urutannya.
    if (sortOrder === 'oldest') {
        filtered = [...filtered].reverse();
    }

    const tbody = document.getElementById('soundTableBody');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">Gak ada sound yang cocok.</td></tr>`;
    }

    filtered.forEach(sound => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-900/60';

        const createdText = sound.created
            ? new Date(sound.created).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
            : '-';

        row.innerHTML = `
            <td class="px-4 py-2.5 font-mono text-blue-300">${sound.assetId}</td>
            <td class="px-4 py-2.5 text-gray-200">${sound.name}</td>
            <td class="px-4 py-2.5">${getStatusBadge(sound.status)}</td>
            <td class="px-4 py-2.5 text-gray-400 text-xs">${createdText}</td>
            <td class="px-4 py-2.5 text-right">
                <button onclick="copySingleId('${sound.assetId}')" title="Copy Asset ID"
                        class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300">Copy ID</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('shownCount').innerText = filtered.length;
}

function copySingleId(assetId) {
    navigator.clipboard.writeText(String(assetId)).then(() => {
        alert(`Asset ID ${assetId} berhasil di-copy!`);
    });
}

function copyAllIds() {
    if (currentSoundsData.length === 0) return;
    const ids = currentSoundsData.map(s => s.assetId).join('\n');
    navigator.clipboard.writeText(ids).then(() => {
        alert('Semua Asset ID berhasil di-copy!');
    });
}

function downloadCsv() {
    if (currentSoundsData.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Asset ID,Name,Status,Created\n";

    currentSoundsData.forEach(row => {
        const safeName = row.name.replace(/"/g, '""');
        const createdCsv = row.created ? new Date(row.created).toISOString().split('T')[0] : '';
        csvContent += `${row.assetId},"${safeName}",${row.status},${createdCsv}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "roblox_sounds.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
