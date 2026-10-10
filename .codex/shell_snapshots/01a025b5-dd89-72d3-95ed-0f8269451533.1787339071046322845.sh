# Snapshot file
# Unset all aliases to avoid conflicts with functions
# Functions
deliver_motd () 
{ 
    [[ -n "${SSH_TTY:-}" ]] && return 0;
    local COUNTER_INITIAL=0;
    local COUNTER_MAX=5;
    local user_data=${XDG_DATA_DIR:-"${HOME}/.local/share"};
    local motd_file="$user_data/baguette-motd";
    mkdir -p "$user_data" 2> /dev/null || return 1;
    local counter=-1;
    if [[ -f "$motd_file" ]]; then
        { 
            counter=$(< "$motd_file") 2> /dev/null && [[ "$counter" =~ ^[0-9]+$ ]]
        } 2> /dev/null || counter=-1;
    fi;
    if ((counter < COUNTER_INITIAL || counter > COUNTER_MAX)); then
        echo "$COUNTER_INITIAL" > ${motd_file};
        counter=$COUNTER_INITIAL;
    fi;
    if ((counter < COUNTER_MAX)); then
        counter=$((counter + 1));
        echo $counter > "$motd_file";
        print_message;
        if ((counter == COUNTER_MAX)); then
            echo "    (this message will not be repeated again)";
        else
            ((counter == (COUNTER_MAX-1))) && s='' || s='s';
            remaining=$((COUNTER_MAX-counter));
            echo "    (this message will be repeated $remaining more time$s).";
            echo "    (to silence this message, run the following command):";
            echo "        echo $COUNTER_MAX >\"$motd_file\"";
        fi;
    fi
}
print_message () 
{ 
    cat <<-END
NOTICE:
    To simplify system architecture and maintenance, Crostini has switched
    by default to a containerless design for new environments starting in
    ChromeOS version 143 and newer.

    If you experience unexptected issues with the new design, please report
    them using the instructions available at
    https://www.chromium.org/chromium-os/developer-library/guides/bugs/platform-public-tracker/.

    If you would like to revert to the previous system architecture, you may
    visit chrome://flags#containerless-crostini in your Chrome browser and set
    the flag to "Disabled", then restart your device, and un- and reinstall
    Crostini.

END

}

# setopts 3
set -o braceexpand
set -o hashall
set -o interactive-comments

# aliases 0

# exports 40
declare -x BROWSER="/usr/bin/garcon-url-handler"
declare -x CODEX_MANAGED_BY_NPM="1"
declare -x CODEX_MANAGED_PACKAGE_ROOT="/usr/lib/node_modules/@openai/codex"
declare -x DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/1000/bus"
declare -x DISPLAY=":0"
declare -x DISPLAY_LOW_DENSITY=":1"
declare -x GPG_AGENT_INFO="/run/user/1000/gnupg/S.gpg-agent:0:1"
declare -x GTK_IM_MODULE="cros"
declare -x HOME="/home/sleeky3750"
declare -x INVOCATION_ID="4d171e7294454c88b08602a66a41202d"
declare -x JOURNAL_STREAM="7:9994"
declare -x LANG="C.UTF-8"
declare -x LD_ARGV0_REL="../bin/vshd"
declare -x LOGNAME="sleeky3750"
declare -x LS_COLORS="rs=0:di=01;34:ln=01;36:mh=00:pi=40;33:so=01;35:do=01;35:bd=40;33;01:cd=40;33;01:or=40;31;01:mi=00:su=37;41:sg=30;43:ca=00:tw=30;42:ow=34;42:st=37;44:ex=01;32:*.7z=01;31:*.ace=01;31:*.alz=01;31:*.apk=01;31:*.arc=01;31:*.arj=01;31:*.bz=01;31:*.bz2=01;31:*.cab=01;31:*.cpio=01;31:*.crate=01;31:*.deb=01;31:*.drpm=01;31:*.dwm=01;31:*.dz=01;31:*.ear=01;31:*.egg=01;31:*.esd=01;31:*.gz=01;31:*.jar=01;31:*.lha=01;31:*.lrz=01;31:*.lz=01;31:*.lz4=01;31:*.lzh=01;31:*.lzma=01;31:*.lzo=01;31:*.pyz=01;31:*.rar=01;31:*.rpm=01;31:*.rz=01;31:*.sar=01;31:*.swm=01;31:*.t7z=01;31:*.tar=01;31:*.taz=01;31:*.tbz=01;31:*.tbz2=01;31:*.tgz=01;31:*.tlz=01;31:*.txz=01;31:*.tz=01;31:*.tzo=01;31:*.tzst=01;31:*.udeb=01;31:*.war=01;31:*.whl=01;31:*.wim=01;31:*.xz=01;31:*.z=01;31:*.zip=01;31:*.zoo=01;31:*.zst=01;31:*.avif=01;35:*.jpg=01;35:*.jpeg=01;35:*.jxl=01;35:*.mjpg=01;35:*.mjpeg=01;35:*.gif=01;35:*.bmp=01;35:*.pbm=01;35:*.pgm=01;35:*.ppm=01;35:*.tga=01;35:*.xbm=01;35:*.xpm=01;35:*.tif=01;35:*.tiff=01;35:*.png=01;35:*.svg=01;35:*.svgz=01;35:*.mng=01;35:*.pcx=01;35:*.mov=01;35:*.mpg=01;35:*.mpeg=01;35:*.m2v=01;35:*.mkv=01;35:*.webm=01;35:*.webp=01;35:*.ogm=01;35:*.mp4=01;35:*.m4v=01;35:*.mp4v=01;35:*.vob=01;35:*.qt=01;35:*.nuv=01;35:*.wmv=01;35:*.asf=01;35:*.rm=01;35:*.rmvb=01;35:*.flc=01;35:*.avi=01;35:*.fli=01;35:*.flv=01;35:*.gl=01;35:*.dl=01;35:*.xcf=01;35:*.xwd=01;35:*.yuv=01;35:*.cgm=01;35:*.emf=01;35:*.ogv=01;35:*.ogx=01;35:*.aac=00;36:*.au=00;36:*.flac=00;36:*.m4a=00;36:*.mid=00;36:*.midi=00;36:*.mka=00;36:*.mp3=00;36:*.mpc=00;36:*.ogg=00;36:*.ra=00;36:*.wav=00;36:*.oga=00;36:*.opus=00;36:*.spx=00;36:*.xspf=00;36:*~=00;90:*#=00;90:*.bak=00;90:*.crdownload=00;90:*.dpkg-dist=00;90:*.dpkg-new=00;90:*.dpkg-old=00;90:*.dpkg-tmp=00;90:*.old=00;90:*.orig=00;90:*.part=00;90:*.rej=00;90:*.rpmnew=00;90:*.rpmorig=00;90:*.rpmsave=00;90:*.swp=00;90:*.tmp=00;90:*.ucf-dist=00;90:*.ucf-new=00;90:*.ucf-old=00;90:"
declare -x MANAGERPID="248"
declare -x MEMORY_PRESSURE_WATCH="/sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/cros-garcon.service/memory.pressure"
declare -x MEMORY_PRESSURE_WRITE="c29tZSAyMDAwMDAgMjAwMDAwMAA="
declare -x NCURSES_NO_UTF8_ACS="1"
declare -x PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
declare -x QT_AUTO_SCREEN_SCALE_FACTOR="1"
declare -x QT_QPA_PLATFORMTHEME="gtk2"
declare -x SHELL="/bin/bash"
declare -x SHLVL="2"
declare -x SOMMELIER_VERSION="0.20"
declare -x SOMMELIER_VM_IDENTIFIER="73cbdcc5-3765-4311-a3f3-3200f9613304"
declare -x SSH_AUTH_SOCK="/run/user/1000/openssh_agent"
declare -x SYSTEMD_EXEC_PID="1326"
declare -x TERM="xterm-256color"
declare -x USER="sleeky3750"
declare -x WAYLAND_DISPLAY="wayland-0"
declare -x WAYLAND_DISPLAY_LOW_DENSITY="wayland-1"
declare -x XCURSOR_SIZE="24"
declare -x XCURSOR_SIZE_LOW_DENSITY="12"
declare -x XCURSOR_THEME="Adwaita"
declare -x XDG_CONFIG_HOME="/home/sleeky3750/.config"
declare -x XDG_CURRENT_DESKTOP="X-Generic"
declare -x XDG_DATA_DIRS="/home/sleeky3750/.local/share:/home/sleeky3750/.local/share/flatpak/exports/share:/var/lib/flatpak/exports/share:/usr/local/share:/usr/share"
declare -x XDG_RUNTIME_DIR="/run/user/1000"
declare -x XDG_SESSION_TYPE="wayland"
