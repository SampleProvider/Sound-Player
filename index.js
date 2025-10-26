window.onerror = function(message, source, lineno, colno, error) {
    modal("ERROR BUG BUG BUG!!!", source + "<br>" + message + " " + source + " " + lineno + " " + colno, "error");
};

window.onresize = () => {
    document.body.style.setProperty("--border-size", Number(getComputedStyle(currSongContainer).getPropertyValue("border-left-width").replaceAll("px", "")) / 2 + "px");
};
window.onresize();

let mediaSessionEnabled = navigator.mediaSession != null;
mediaSessionEnabled = false;

function modal(title, content, type) {
    modalContainer.showModal();
    modalTitle.innerHTML = title;
    modalContent.innerHTML = content;
    if (type == "confirm") {
        modalInputs.style.display = "none";
        modalYes.style.display = "revert-layer";
        modalNo.style.display = "revert-layer";
        modalOk.style.display = "none";
        modalYes.innerText = "Yes";
        modalNo.innerText = "No";
    }
    else if (type == "info" || type == "error") {
        modalInputs.style.display = "none";
        modalYes.style.display = "none";
        modalNo.style.display = "none";
        modalOk.style.display = "revert-layer";
    }
    else if (type == "editPlaylist") {
        modalInputs.style.display = "revert-layer";
        modalLabel1.innerText = "Name: ";
        modalLabel2.innerText = "Description: ";
        modalYes.style.display = "revert-layer";
        modalNo.style.display = "revert-layer";
        modalOk.style.display = "none";
        modalYes.innerText = "Save";
        modalNo.innerText = "Cancel";
    }
    else if (type == "editSong") {
        modalInputs.style.display = "revert-layer";
        modalLabel1.innerText = "Name: ";
        modalLabel2.innerText = "Artist: ";
        modalYes.style.display = "revert-layer";
        modalNo.style.display = "revert-layer";
        modalOk.style.display = "none";
        modalYes.innerText = "Save";
        modalNo.innerText = "Cancel";
    }

    if (type == "error") {
        modalTitle.innerHTML = "An error has occured";
        modalContent.innerHTML = title + "<br><br>" + content + "<br><br>Please report this to the developers";
    }
    return new Promise((resolve, reject) => {
        modalContainer.onclose = () => {
            resolve(modalContainer.returnValue == "true");
            modalContainer.returnValue = null;
        };
    });
};
modalYes.onclick = () => {
    modalContainer.close("true");
};
modalNo.onclick = () => {
    modalContainer.close("false");
};
modalOk.onclick = () => {
    modalContainer.close("true");
};

const audioCtx = new AudioContext();
const globalGain = audioCtx.createGain();
globalGain.connect(audioCtx.destination);

let settings = {
    volume: 100,
    lazyRead: false,
    autoplay: false,
    loop: false,
    shuffle: false,
};

try {
    let json = JSON.parse(localStorage.getItem("settings"));
    for (let i in settings) {
        if (typeof settings[i] == typeof json[i]) {
            settings[i] = json[i];
        }
    }
}
catch (err) {

}
window.addEventListener("beforeunload", function() {
    localStorage.setItem("settings", JSON.stringify(settings));
});

lazyReadButton.oninput = function() {
    settings.lazyRead = lazyReadButton.checked;
};
lazyReadButton.checked = settings.lazyRead;
autoplayButton.oninput = function() {
    settings.autoplay = autoplayButton.checked;
};
autoplayButton.checked = settings.autoplay;
loopButton.oninput = function() {
    settings.loop = loopButton.checked;
};
loopButton.checked = settings.loop;
shuffleButton.oninput = function() {
    settings.shuffle = shuffleButton.checked;
};
shuffleButton.checked = settings.shuffle;
volumeButton.onclick = function() {
    if (volumeSlider.value != 0) {
        volumeSlider.value = 0;
    }
    else {
        volumeSlider.value = 100;
    }
    volumeSlider.oninput();
};
volumeSlider.oninput = function() {
    settings.volume = Number(volumeSlider.value);
    globalGain.gain.value = settings.volume / 100;
    volumeSlider.title = settings.volume + "%";
    if (settings.volume == 0) {
        volumeButton.style.backgroundImage = "url(\"/img/volume-mute.svg\")";
    }
    else if (settings.volume <= 33) {
        volumeButton.style.backgroundImage = "url(\"/img/volume0.svg\")";
    }
    else if (settings.volume <= 66) {
        volumeButton.style.backgroundImage = "url(\"/img/volume1.svg\")";
    }
    else {
        volumeButton.style.backgroundImage = "url(\"/img/volume2.svg\")";
    }
    if (settings.volume == 0) {
        volumeButton.title = "Unmute volume";
    }
    else {
        volumeButton.title = "Mute volume";
    }
};
volumeSlider.value = settings.volume;
volumeSlider.oninput();

let playlist = null;
let currSong = null;

function stringifyTime(length) {
    let hours = Math.floor(length / 3600);
    let minutes = Math.floor(length / 60) % 60;
    let seconds = Math.floor(length % 60);
    if (hours > 0 && minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    if (hours > 0) {
        return hours + ":" + minutes + ":" + seconds;
    }
    return minutes + ":" + seconds;
};

class Song {
    name = "Untitled";
    artist = "No artist";
    length = 0;
    metadataHandle = null;
    buffer = null;
    bufferData = null;
    readingBuffer = false;
    readBuffer = false;
    source = null;
    startTime = 0;
    currTime = 0;
    playing = false;
    div = null;
    constructor(data, metadata, metadataHandle) {
        this.metadataHandle = metadataHandle;
        playlistSongs.appendChild(songTemplate.content.cloneNode(true));
        this.div = playlistSongs.children[playlistSongs.children.length - 1];
        this.div.querySelector(".songEditButton").onclick = async () => {
            modalInput1.value = this.name;
            modalInput2.value = this.artist;
            if (await modal("Edit song", "", "editSong")) {
                this.name = modalInput1.value;
                this.artist = modalInput2.value;
                this.updateDiv();
                this.writeMetadata();
            }
        };
        this.div.querySelector(".songPlayButton").onclick = async () => {
            if (this.div.querySelector(".songPlayButton").classList.contains("playing")) {
                this.stop();
            }
            else {
                if (this != currSong) {
                    currSong.stop();
                    currSong.currTime = 0;
                    currSong = this;
                    this.updateCurrSongDiv();
                }
                this.start();
            }
        };
        this.bufferData = data;
        if (!settings.lazyRead) {
            this.loadData(data);
        }
        this.loadMetadata(metadata);
    }
    loadData(data) {
        return new Promise((resolve) => {
            this.readingBuffer = true;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                this.buffer = audioBuffer;
                this.length = this.buffer.duration;
                if (!this.readBuffer) {
                    this.writeMetadata();
                }
                this.readingBuffer = false;
                this.readBuffer = true;
                this.updateDiv();
                resolve();
            };
            reader.readAsArrayBuffer(data);
        });
    }
    loadMetadata(data) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (json.name == null) {
                    json.name = data.name.split(".")[0];
                }
                this.name = json.name ?? "Untitled";
                this.artist = json.artist ?? "No artist";
                if (!this.readBuffer && !isNaN(json.length)) {
                    this.length = json.length;
                }
            }
            catch (err) {
                this.name = data.name.split(".")[0];
            }
            this.updateDiv();
        };
        reader.readAsText(data);
    }
    async writeMetadata() {
        const writable = await this.metadataHandle.createWritable();
        await writable.write(JSON.stringify({
            name: this.name,
            artist: this.artist,
            length: this.length,
        }));
        await writable.close();
    }
    updateDiv() {
        this.div.querySelector(".songName").children[0].innerText = this.name;
        this.div.querySelector(".songArtist").innerText = this.artist;
        this.div.querySelector(".songLength").innerText = stringifyTime(this.length);
        if (this == currSong) {
            this.updateCurrSongDiv();
        }
    }
    updateCurrSongDiv() {
        currSongName.innerText = this.name;
        currSongArtist.innerText = this.artist;
        currSongLength.innerText = stringifyTime(this.length);
        currSongProgress.max = this.length;
    }

    async start() {
        this.playing = true;
        if (this.buffer == null) {
            if (!this.readingBuffer) {
                await this.loadData(this.bufferData);
                if (!this.playing) {
                    return;
                }
            }
            else {
                return;
            }
        }
        if (this.source == null) {
            this.source = new AudioBufferSourceNode(audioCtx, {
                buffer: this.buffer,
            });
            this.source.connect(globalGain);
        }
        else {
            return;
        }
        if (this.currTime > this.length) {
            this.currTime = this.length;
        }
        this.source.start(0, this.currTime);
        this.source.onended = () => {
            this.stop();
            if (settings.loop) {
                this.start();
            }
            else if (settings.autoplay) {
                let index = playlist.songs.indexOf(this);
                let nextSong = playlist.songs[(index + 1) % playlist.songs.length];
                if (nextSong != currSong) {
                    currSong.stop();
                    currSong.currTime = 0;
                    currSong = nextSong;
                    nextSong.updateCurrSongDiv();
                }
                nextSong.start();
            }
            else if (settings.shuffle) {
                let index = Math.floor(Math.random() * (playlist.songs.length - 1));
                if (index >= playlist.songs.indexOf(this)) {
                    index += 1;
                }
                let nextSong = playlist.songs[index];
                if (nextSong != currSong) {
                    currSong.stop();
                    currSong.currTime = 0;
                    currSong = nextSong;
                    nextSong.updateCurrSongDiv();
                }
                nextSong.start();
            }
        };
        this.startTime = audioCtx.currentTime - this.currTime;
        this.div.querySelector(".songPlayButton").classList.add("playing");
        if (this == currSong) {
            currSongPlayButton.classList.add("playing");
        }
        if (mediaSessionEnabled) {
            navigator.mediaSession.playbackState = "playing";
        }
    }
    stop(preventBufferDeletion) {
        this.playing = false;
        if (this.source == null) {
            return;
        }
        this.source.onended = function() {};
        this.source.stop();
        this.source.disconnect();
        this.source = null;
        if (settings.lazyRead && !preventBufferDeletion) {
            // preventBufferDeletion also kind of spaghetti
            this.buffer = null;
        }
        this.currTime = audioCtx.currentTime - this.startTime;
        this.div.querySelector(".songPlayButton").classList.remove("playing");
        if (this == currSong) {
            currSongPlayButton.classList.remove("playing");
        }
        if (mediaSessionEnabled) {
            navigator.mediaSession.playbackState = "paused";
        }
    }
}

class Playlist {
    name = "Untitled";
    description = "No description";
    metadataHandle = null;
    songs = [];
    constructor(directoryHandle, metadata, metadataHandle) {
        this.metadataHandle = metadataHandle;
        this.loadMetadata(directoryHandle, metadata);
    }
    async addSong(data, metadataHandle, metadata) {
        let song = new Song(data, metadataHandle, metadata);
        this.songs.push(song);
        if (currSong == null) {
            currSong = song;
            song.updateCurrSongDiv();
        }
    }
    loadMetadata(directoryHandle, data) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target.result);
                this.name = json.name ?? "Untitled";
                this.description = json.description ?? "No description";
            }
            catch (err) {
                // this is so spaghetti there has to be a better way
                this.name = directoryHandle.name;
            }
            this.updateDiv();
        };
        reader.readAsText(data);
    }
    async writeMetadata() {
        const writable = await this.metadataHandle.createWritable();
        await writable.write(JSON.stringify({
            name: this.name,
            description: this.description,
        }));
        await writable.close();
    }
    updateDiv() {
        document.getElementById("playlistName").children[0].innerText = this.name;
        document.getElementById("playlistDescription").innerText = this.description;
    }
}

currSongPlayButton.onclick = function() {
    if (currSong != null) {
        if (currSongPlayButton.classList.contains("playing")) {
            currSong.stop();
        }
        else {
            currSong.start();
        }
    }
};
currSongProgress.oninput = function() {
    if (currSong != null) {
        if (currSong.source != null) {
            currSong.stop(true);
            currSong.currTime = currSongProgress.value;
            currSong.start();
        }
        else {
            currSong.currTime = currSongProgress.value;
        }
    }
};
playlistEditButton.onclick = async function() {
    modalInput1.value = playlist.name;
    modalInput2.value = playlist.description;
    if (await modal("Edit playlist", "", "editPlaylist")) {
        playlist.name = modalInput1.value;
        playlist.description = modalInput2.value;
        playlist.updateDiv();
        playlist.writeMetadata();
    }
};
uploadButton.onclick = async function() {
    let directoryHandle = await window.showDirectoryPicker({
        id: "audioPlayer",
        mode: "readwrite",
        startIn: "music",
    });
    let metadataHandle = await directoryHandle.getFileHandle("metadata.json", {
        create: true,
    });
    if (currSong != null) {
        currSong.stop();
    }
    playlistSongs.innerHTML = "";
    playlist = new Playlist(directoryHandle, await metadataHandle.getFile(), metadataHandle);
    currSong = null;
    async function* getFilesRecursively(entry, dir) {
        if (entry.kind == "file") {
            const file = await entry.getFile();
            file.dir = dir;
            yield file;
            // if (file != null) {
            //     // file.relativePath = getRelativePath(entry);
            //     yield file;
            // }
        }
        else if (entry.kind == "directory") {
            for await (const handle of entry.values()) {
                yield* getFilesRecursively(handle, entry);
            }
        }
    }
    let files = [];
    for await (const file of getFilesRecursively(directoryHandle, directoryHandle)) {
        if (file.type.startsWith("audio")) {
            files.push(file);
        }
    }
    files.sort(function(a, b) {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    for (let file of files) {
        let metadataHandle = await file.dir.getFileHandle(file.name + ".json", {
            create: true,
        });
        playlist.addSong(file, await metadataHandle.getFile(), metadataHandle);
    }
    if (playlist.songs.length <= 1) {
        shuffleButton.disabled = true;
        shuffleButton.checked = false;
    }
    else {
        shuffleButton.disabled = false;
    }
};
if (mediaSessionEnabled) {
    navigator.mediaSession.setActionHandler("play", () => {
        if (currSong != null) {
            if (currSong.source == null) {
                currSong.start();
            }
            else {
                currSong.stop();
            }
        }
    });
    navigator.mediaSession.setActionHandler("pause", () => {
        if (currSong != null) {
            if (currSong.source == null) {
                currSong.start();
            }
            else {
                currSong.stop();
            }
        }
    });
    navigator.mediaSession.setActionHandler("stop", () => {
        if (currSong != null) {
            if (currSong.source == null) {
                currSong.start();
            }
            else {
                currSong.stop();
            }
        }
    });
    // navigator.mediaSession.setActionHandler("seekbackward", () => {
    //     if (currSong != null) {
    //         currSong.stop();
    //         currSong.currTime -= 5;
    //         currSong.start();
    //     }
    // });
    // navigator.mediaSession.setActionHandler("seekforward", () => {
    //     if (currSong != null) {
    //         currSong.stop();
    //         currSong.currTime += 5;
    //         currSong.start();
    //     }
    // });
    // navigator.mediaSession.setActionHandler("seekto", () => {
    // });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
        let index = playlist.songs.indexOf(currSong);
        let nextSong = playlist.songs[(index + playlist.songs.length - 1) % playlist.songs.length];
        if (nextSong != currSong) {
            currSong.stop();
            currSong.currTime = 0;
            currSong = nextSong;
            nextSong.updateCurrSongDiv();
        }
        nextSong.start();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
        let index = playlist.songs.indexOf(currSong);
        let nextSong = playlist.songs[(index + 1) % playlist.songs.length];
        if (nextSong != currSong) {
            currSong.stop();
            currSong.currTime = 0;
            currSong = nextSong;
            nextSong.updateCurrSongDiv();
        }
        nextSong.start();
    });
}

document.onkeydown = function(e) {
    if (modalContainer.open) {
        return;
    }
    if (e.key == " ") {
        currSongPlayButton.click();
        e.preventDefault();
    }
};

function update() {
    if (currSong != null) {
        let time = 0;
        if (currSong.source != null) {
            time = audioCtx.currentTime - currSong.startTime;
        }
        else {
            time = currSong.currTime;
        }
        currSongTime.innerText = stringifyTime(Math.floor(time));
        currSongProgress.value = time;
        currSongProgress.title = stringifyTime(Math.floor(time)) + "/" + stringifyTime(Math.floor(currSong.length));
        if (mediaSessionEnabled) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currSong.name,
                artist: currSong.artist,
                album: playlist.name,
            });
        }
    }
    window.requestAnimationFrame(update);
};
window.requestAnimationFrame(update);