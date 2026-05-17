[CmdletBinding()]
param(
    [ValidateSet("tiny", "base", "small", "medium", "large-v3", "large-v3-turbo")]
    [string]$WhisperModel = "large-v3-turbo",

    [switch]$SkipFfmpeg,
    [switch]$SkipWhisperCli,
    [switch]$SkipWhisperModel,
    [switch]$SkipDiarization,
    [string]$HuggingFaceToken = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$ToolsDir = Join-Path $RepoRoot "tools"
$ModelsDir = Join-Path $RepoRoot "models"
$DownloadDir = Join-Path $ToolsDir "_downloads"

$FfmpegDir = Join-Path $ToolsDir "ffmpeg"
$WhisperCliDir = Join-Path $ToolsDir "whisper.cpp"
$WhisperModelDir = Join-Path $ModelsDir "whisper"

function Ensure-Directory {
    param([Parameter(Mandatory)][string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Download-File {
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$OutFile
    )

    if ((Test-Path $OutFile) -and -not $Force) {
        Write-Host "Usando arquivo existente: $OutFile"
        return
    }

    Write-Host "Baixando: $Url"
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

function Expand-Zip {
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)][string]$Destination
    )

    Write-Host "Extraindo: $ZipPath"
    Ensure-Directory $Destination
    Expand-Archive -Path $ZipPath -DestinationPath $Destination -Force
}

Ensure-Directory $DownloadDir
Ensure-Directory $FfmpegDir
Ensure-Directory $WhisperCliDir
Ensure-Directory $WhisperModelDir

if (-not $SkipFfmpeg) {
    $existingFfmpeg = Get-ChildItem -Path $FfmpegDir -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingFfmpeg -and -not $Force) {
        Write-Host "FFmpeg ja existe: $($existingFfmpeg.FullName)"
    }
    else {
        $ffmpegZip = Join-Path $DownloadDir "ffmpeg-release-essentials.zip"
        Download-File -Url "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $ffmpegZip
        Expand-Zip -ZipPath $ffmpegZip -Destination $FfmpegDir
    }
}

if (-not $SkipWhisperCli) {
    $existingWhisperCli = Get-ChildItem -Path $WhisperCliDir -Recurse -Filter "whisper-cli.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingWhisperCli -and -not $Force) {
        Write-Host "whisper-cli ja existe: $($existingWhisperCli.FullName)"
    }
    else {
        Write-Host "Consultando release mais recente do whisper.cpp..."
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest"
        $asset = $release.assets | Where-Object { $_.name -eq "whisper-bin-x64.zip" } | Select-Object -First 1

        if (-not $asset) {
            throw "Nao encontrei o asset whisper-bin-x64.zip na release mais recente do whisper.cpp."
        }

        $whisperZip = Join-Path $DownloadDir "whisper-bin-x64.zip"
        Download-File -Url $asset.browser_download_url -OutFile $whisperZip
        Expand-Zip -ZipPath $whisperZip -Destination $WhisperCliDir
    }
}

if (-not $SkipWhisperModel) {
    $modelFileName = "ggml-$WhisperModel.bin"
    $modelPath = Join-Path $WhisperModelDir $modelFileName

    if ((Test-Path $modelPath) -and -not $Force) {
        Write-Host "Modelo Whisper ja existe: $modelPath"
    }
    else {
        $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$modelFileName"
        Download-File -Url $modelUrl -OutFile $modelPath
    }
}

$ffmpegPath = Get-ChildItem -Path $FfmpegDir -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$whisperCliPath = Get-ChildItem -Path $WhisperCliDir -Recurse -Filter "whisper-cli.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$selectedModelPath = Join-Path $WhisperModelDir "ggml-$WhisperModel.bin"

# ─── OPCIONAL: Diarização (identificação de falantes) ─────────────────────────
if (-not $SkipDiarization) {
    Write-Host ""
    Write-Host "[Diarizacao] Verificando Python..."
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        Write-Host "  Python nao encontrado. Instale Python 3.10+ e execute novamente para configurar diarizacao." -ForegroundColor Yellow
    }
    else {
        Write-Host "  Python encontrado: $($pythonCmd.Source)"
        Write-Host "  Instalando pyannote.audio..."
        & python -m pip install -U pyannote.audio --quiet

        Write-Host "  Instalando dependencias PyTorch CPU (~2 GB no total)..."
        & python -m pip install -U --force-reinstall torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu --quiet

        if ($HuggingFaceToken) {
            Write-Host "  Baixando modelo pyannote/speaker-diarization-3.1..."
            Write-Host "  (Certifique-se de aceitar os termos em https://hf.co/pyannote/speaker-diarization-3.1)" -ForegroundColor Cyan
            & python -c "from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', use_auth_token='$HuggingFaceToken')"
            Write-Host "  Modelo salvo em cache local. Token nao sera necessario em runtime." -ForegroundColor Green
        }
        else {
            Write-Host "  Token HuggingFace nao fornecido. Forneca -HuggingFaceToken hf_... para baixar o modelo agora." -ForegroundColor Yellow
            Write-Host "  Ou configure o token em Settings -> Diarizacao apos instalar o app." -ForegroundColor Yellow
        }

        $diarizeScriptPath = Join-Path $ScriptDir "diarize.py"
        Write-Host ""
        Write-Host "  Script de diarizacao: $diarizeScriptPath"
        Write-Host "  Configure em Settings -> Diarizacao:"
        Write-Host "    Caminho do Python:     $($pythonCmd.Source)"
        Write-Host "    Caminho do diarize.py: $diarizeScriptPath"
    }
}

Write-Host ""
Write-Host "Concluido. Configure estes caminhos no app:"
if ($ffmpegPath) {
    Write-Host "FFmpeg:       $($ffmpegPath.FullName)"
}
else {
    Write-Host "FFmpeg:       nao encontrado"
}

if ($whisperCliPath) {
    Write-Host "whisper-cli:  $($whisperCliPath.FullName)"
}
else {
    Write-Host "whisper-cli:  nao encontrado"
}

if (Test-Path $selectedModelPath) {
    Write-Host "Modelo:       $selectedModelPath"
}
else {
    Write-Host "Modelo:       nao encontrado"
}
