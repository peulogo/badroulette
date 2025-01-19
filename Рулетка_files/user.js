window.addEventListener('load', () => {

    let bets = {};
    let bets_amounts = {};
    let borders = {};
    let order = [];
    let chip_values = {};
    let total_amount = 0;
    let track_data = ['3', '26', '0', '32', '15', '19', '4', '21', '2', '25', '17', '34', '6', '27', '13',
                        '36', '11', '30', '8', '23', '10', '5', '24', '16', '33', '1', '20', '14',
                        '31', '9', '22', '18', '29', '7', '28', '12', '35', '3', '26', '0', '32'];
    let track_reverse_css = {
        'track_23': {'left': 'auto', 'right': '8%', 'bottom': '3%', 'top': 'auto'},
        'track_10': {'left': 'auto', 'right': '8%', 'bottom': 'auto', 'top': '3%'},
        'track_26': {'right': 'auto', 'left': '8%'},
        'track_5': {'right': 'auto', 'left': '15%', 'bottom': '8%', 'top': 'auto'},
        'track_8': {'right': 'auto', 'left': '15%', 'bottom': 'auto', 'top': '8%'},
        'track_3': {'left': 'auto', 'right': '15%', 'bottom': '8%', 'top': 'auto'},
        'track_0': {'left': 'auto', 'right': '15%', 'bottom': 'auto', 'top': '9%'},
        'tiers': {'left': 'auto', 'right': '40.59%'},
        'orphelins': {'left': 'auto', 'right': '53%'},
        'voisins': {'left': 'auto', 'right': '38.58%'},
        'jeu': {'left': 'auto', 'right': '40%'}
    }
    let chip_id, chip_value, colorTimeout, infoTimeout, status, close_bets_interval;
    let field_lock = false;
    let chip_lock = false;
    let info_lock = false;
    let resume_lock = false;
    let preset_lock = false;
    let erase = false;
    let info_list = [];
    let complex_data = {};
    let complex_lock = false;
    let close_bets_auto_spin = false;
    let last_log = parseInt($('#last_log').val());
    let balance = parseInt($('.stream_balance')[0].innerHTML);
    let admin_id = parseInt($('#admin_id').val());
    let last_spin = parseInt($('#last_spin').val());
    let table_maximum = parseInt($('#table_maximum').val());
    let minimum_50 = parseInt($('#minimum_50').val());
    let minimum_33 = parseInt($('#minimum_33').val());
    let number_maximum = parseInt($('#number_maximum').val());

    $('#admin_id').remove();
    $('#last_spin').remove();
    $('#table_maximum').remove();
    $('#minimum_50').remove();
    $('#minimum_33').remove();
    $('#number_maximum').remove();
    $('#last_log').remove();

    $('.stream_chip_value').each((i, chip) => {
        let chip_id = chip.classList[1].replace('value_', '');
        let value = chip.innerHTML;
        chip_values[chip_id] = parseInt(value);
        chip.innerHTML = convertNumberToK(value);
    })

    openSocket();
    resume();
    
    function resume() {
        if($('.stream_ended').length > 0) {
            streamFinished();
        } else if($('#user_status').val() == 'True' && !resume_lock) {
            resume_lock = true;
            const token = $('input[name=csrfmiddlewaretoken]').val();
            $.ajax({
                method: "post",
                url: "/user_page/resume/",
                data: {admin_pk: admin_id, csrfmiddlewaretoken: token},
                success: (data) => {
                    if(data['result'] == 'ok') {
                        enableUser(data);
                        $('.stream_resume_background').remove();
                        $('.stream_resume_block').remove();
                    } else if(data['result'] == 'failed') {
                        streamFinished();
                    }
                },
                error: (data) => {
                }
            });
        }
    }

    function convertNumberToK(value, round=100) {
        if(value >= 1000) {
            let thousands = 1;
            let k = 'k';
            let number = 0
            while(!number) {
                if(value / (1000 ** (thousands + 1)) >= 1) {
                    thousands += 1;
                    k += 'k';
                } else {
                    if(Math.round((value / (1000 ** thousands) + Number.EPSILON)) > 100) {
                        number = Math.round((value / (1000 ** thousands) + Number.EPSILON));
                    } else {
                        number = Math.round((value / (1000 ** thousands) + Number.EPSILON) * round) / round;
                    }
                }
            }
            return `${number}${k}`;
        }
        return value
    }

    function showInfo(value) {
        if(!info_lock) {
            info_lock = true;
            $('.stream_info_content').html('');
            $('.stream_info_content').css('display', '');
            let i = 0;
            let interval = window.setInterval(() => {
                $('.stream_info_content').append(value[i]);
                if(i == value.length - 1) {
                    window.clearInterval(interval);
                    info_lock = false;
                    if(info_list.length > 0) {
                        window.setTimeout(() => showInfo(info_list.pop()), 1000);
                    }
                }
                i++;
            }, 50)
        } else if(!info_list.includes(value)){
            info_list.push(value);
        }
    }

    function setCloseBetsTimeouts(time) {
        window.clearInterval(close_bets_interval);
        let minutes = Math.floor(time / 60);
        let seconds = time % 60;
        $('.stream_timeout_minutes').html(minutes >= 10 ? minutes : '0' + minutes);
        $('.stream_timeout_seconds').html(seconds >= 10 ? seconds : '0' + seconds);
        close_bets_interval = window.setInterval(() => {
            if(seconds == 0) {
                if(minutes == 0) {
                    window.clearInterval(close_bets_interval);
                    $('.stream_timeout').css('display', '');
                } else {
                    minutes -= 1;
                    seconds = 60;
                    $('.stream_timeout_minutes').html(minutes >= 10 ? minutes : '0' + minutes);
                }
            }
            seconds -= 1;
            $('.stream_timeout_seconds').html(seconds >= 10 ? seconds : '0' + seconds);
        }, 1000);
        $('.stream_timeout').css('display', 'block');
    }

    window.addEventListener('focus', () => {
        info_list = info_list.slice(info_list.length - 1);
    })

    function changeBalance(new_balance, add_fakes) {
        $('.stream_balance').html(new_balance);
        if(balance < new_balance) {
            $('.stream_balance_change').html(`+${new_balance - balance}`);
            window.setTimeout(() => {
                $('.stream_balance_change').html('');
            }, 3000);
        }
        balance = new_balance;
        if(status == 'open') {
            if(last_spin > 0 && last_spin <= balance) {
                $('.stream_repeat').removeClass('disabled');
            } else {
                $('.stream_repeat').addClass('disabled');
            }
        }
        if(add_fakes) {
            $('.stream_add_fakes').css('display', 'flex');
            showInfo('Вы можете добавить себе фишек, нажав на "+" рядом с балансом');
        } else {
            $('.stream_add_fakes').css('display', '');
        }
    }

    function openSocket() {

        let protocol = 'wss:';
        if(window.location.protocol == "http:") {
            protocol = 'ws:';
        }

        let userSocket = new WebSocket (
            protocol + '//' + window.location.host + '/ws/user/' + $('#user_id').val() + '/' + admin_id
        );

        userSocket.onopen = (e) => {
            console.log('connection opened')
        }

        userSocket.onmessage = (e) => {
            const data = JSON.parse(e.data)['message'];
            let action = data['action'];

            if(action == 'edit_stream') {
                if(Object.keys(data).includes('link')) {
                    $('.stream_video').remove();
                    $('.stream_bottom_block').before(`<iframe src="${data['link']}"
                                                            title="YouTube video player" frameborder="0"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                            allowfullscreen class="stream_video"></iframe>`);
                    $('#chat').attr('src', data['link'].replace('embed/', 'live_chat?v=') + '&embed_domain=' + window.location.hostname);
                }

                if(Object.keys(data).includes('table_maximum')) {
                    let old = table_maximum;
                    table_maximum = parseInt(data['table_maximum']);
                    $('.stream_table_maximum').html(table_maximum);
                    let color = 'aqua';
                    if(old > table_maximum) {
                        color = 'red';
                    }
                    $('.stream_table_maximum').css('color', color);
                    window.setTimeout(() => {
                        $('.stream_table_maximum').css('color', '');
                    }, 3000)
                    showInfo(`Максимум стола был изменён на ${table_maximum}`);
                }
                if(Object.keys(data).includes('minimum_50')) {
                    minimum_50 = parseInt(data['minimum_50']);
                }
                if(Object.keys(data).includes('minimum_33')) {
                    minimum_33 = parseInt(data['minimum_33']);
                }
                if(Object.keys(data).includes('number_maximum')) {
                    number_maximum = parseInt(data['number_maximum']);
                }
            } else if(action == 'delete_stream') {
                streamFinished();
            } else if(action == 'enable') {
                enableUser(data);
            } else if(action == 'disable') {
                $('.stream_summary_block').css('visibility', '');
                $('.stream_buttons_block').css('visibility', '');
                $('.stream_bets_total').css('display', '');
                $('.stream_table_maximum_block').css('display', '');
                $('.stream_info_content').css('display', '');
                $('.stream_info_content').html('<span class="stream_disabled">Вы не подключены к данной игре. Пожалуйста, подождите или <span class="stream_ask">запросите подключение.</span>');
                $('.stream_ask_block').css('display', 'block');
                if($('.stream_info_arrow > img').css('display') == 'none' || info_lock) {
                    $('.stream_info_arrow').click();
                    window.clearTimeout(infoTimeout);
                }
                window.clearInterval(close_bets_interval);
                $('.stream_timeout').css('display', '');
                $('.stream_close_table').click();
                $('.stream_bets').html('');
                $('.stream_field_chip').remove();
                bets_amounts = {};

            } else if(action == 'change_balance') {
                changeBalance(parseInt(data['new_balance']), data['add_fakes']);
            } else if(action == 'add_chip') {
                let value = parseInt(data['value']);
                chip_values[data['pk']] = value;
                value = convertNumberToK(value);
                if($('.stream_chips_block > .stream_chip').length == 0) {
                    $('.stream_chips_block').html('');
                }

                let chips = $('.stream_chips_block .stream_chip:not(.stream_erase)');
                let before = $('.stream_erase')[0];
                let int_value = parseInt(value);
                for(let old_chip of chips) {
                    if(parseInt(old_chip.dataset.value) > int_value) {
                        before = old_chip;
                        break;
                    }
                }
                $(`.${before.classList[1]}`).before(`<div class="stream_chip chip_${data['pk']}" data-value="${value}" style="background-color: ${data['color']};"><span class="stream_chip_value value_${data['pk']}">${value}</span></div>`);
                if($('.stream_chips_block > .stream_chip').length == 2 && $('.stream_chip_selected').length == 0) {
                    $('.stream_chips_block > .stream_chip').addClass('stream_chip_selected');
                    chip_id = $('.stream_chip_selected').attr('class').replace(/[a-z_ ]+/g, '');
                    chip_value = parseInt(data['value']);
                }
            } else if(action == 'edit_chip') {
                $(`.chip_${data['pk']}`).css('background-color', data['color']);
                $(`.field_chip_${data['pk']}`).css('background-color', data['color']);
                let value = parseInt(data['value']);
                chip_values[data['pk']] = value;
                value = convertNumberToK(value);
                $(`.value_${data['pk']}`).html(value);
                if(chip_id == data['pk']) {
                    chip_value = parseInt(data['value']);
                }

                let chips = $('.stream_chips_block .stream_chip:not(.stream_erase)');
                let before = $('.stream_erase')[0];
                for(let old_chip of chips) {
                    if(parseInt(old_chip.dataset.value) > value) {
                        before = old_chip;
                        break;
                    }
                }
                before.before($(`.stream_chip.chip_${data['pk']}`)[0]);
                $(`.stream_chip.chip_${data['pk']}`).attr('data-value', value);
            } else if(action == 'delete_chip') {
                $(`.chip_${data['pk']}`).remove();
                delete chip_values[data['pk']];
                if($('.stream_chips_block > .stream_chip').length > 1 && $('.stream_chip_selected').length == 0) {
                    $('.stream_chips_block > .stream_chip:last-child').addClass('stream_chip_selected');
                    chip_id = $('.stream_chip_selected').attr('class').replace(/[a-z_ ]+/g, '');
                    chip_value = chip_values[chip_id];
                }
                if($('.stream_chips_block > .stream_chip').length == 1) {
                    chip_id = undefined;
                    chip_value = undefined;
                }
            } else if(action == 'close_bets') {
                if(status != 'closed') {
                    if((data['is_fake'] || $('.stream_auto_spin_checkbox').is(':checked')) && Object.keys(bets).length > 0) {
                        if(!data['is_fake']) {
                            close_bets_auto_spin = true;
                        }
                        $('.stream_spin').click();
                    } else {
                        $('.stream_clear').addClass('disabled');
                        $('.stream_favorites').addClass('disabled');
                        $('.stream_reset_bets').addClass('disabled');
                        $('.stream_spin').addClass('disabled');
                        $('.stream_repeat').addClass('disabled');
                        $('.stream_double').addClass('disabled');
                        bets = {};
                        bets_amounts = {};
                        order = [];
                        total_amount = 0;
                        status = 'closed';
                        if($('.stream_hide_table_checkbox').prop('checked')) {
                            $('.stream_bottom_arrow').click();
                        }
                    };
                }
                if(!data['is_fake']) {
                    for(let chip of data['chips_to_remove']) {
                        if(chip[1] == 0) {
                            $(`.field_chip_${chip[0]}`).remove();
                        } else {
                            $(`.field_chip_${chip[0]}`).html(convertNumberToK(chip[1], 10));
                        }
                    }
                }
                $('.stream_spin').css('display', '');
                $('.stream_undo_spin').css('display', 'none');
                showInfo(`Ставки закрыты`);
            } else if(action == 'get_result') {
                status = 'waiting';
                bets_amounts = {};
                $('.stream_bets').prepend(`<span class="stream_bet stream_bet_number">Число: ${data['number']}</span>`);
                $('.stream_bets').prepend(`<span class="stream_bet">Ставки: ${data['total']}</span>`);
                $('.stream_bets').prepend(`<span class="stream_bet">Результат: <span class="stream_bets_change${data['difference'] < 0 ? ' negative' : ''}">${data['difference'] >= 0 ? '+' : ''}${data['difference']}</span></span>`);
                $('.stream_numbers_label').after(`<span class="stream_number ${data['number_color']}">${data['number']}</span>`);
                $(`#${data['number']}`).addClass('number_won');
                for(let bet of data['bets']) {
                    $(`.bet_${bet[1]}_${bet[0].replace(/ /g, '_')}`).css('color', 'aqua');
                }
                for(let bet of data['not_placed']) {
                    $(`.bet_${bet[1]}_${bet[0].replace(/ /g, '_')}`).css('color', 'red');
                }
                if(data['add_fakes']) {
                    $('.stream_add_fakes').css('display', 'flex');
                } else {
                    $('.stream_add_fakes').css('display', '');
                }
                changeBalance(parseInt(data['balance']), data['add_fakes']);
                showInfo(`Выпало число ${data['number']}`);
            } else if(action == 'reset_result') {
                status = 'closed';
                balance = data['balance'];
                $('.stream_balance').html(balance);
                $('.stream_bet').css('color', '');
                $('.number_won').removeClass('number_won');
                $('.stream_bet:first-child').remove();
                $('.stream_bet:first-child').remove();
                $('.stream_bet:first-child').remove();
                $('.stream_field_chip').css('display', '');
                $('.stream_number:nth-child(2)').remove();
                if(data['add_fakes']) {
                    $('.stream_add_fakes').css('display', 'flex');
                } else {
                    $('.stream_add_fakes').css('display', '');
                }
                showInfo(`Выпавшее число было сброшено`);
            } else if(action == 'open_bets') {
                status = 'open';
                $('.stream_clear').removeClass('disabled');
                $('.stream_favorites').removeClass('disabled');
                $('.stream_reset_bets').removeClass('disabled');
                if(last_spin > 0 && last_spin <= balance) {
                    $('.stream_repeat').removeClass('disabled');
                }
                $('.stream_double').removeClass('disabled');
                if($('.stream_bet').length > 0) {
                    $('.stream_bet > span:not(.stream_bets_change)').attr('class', '');
                    $('.stream_bet_number').attr('class', 'stream_past_bet stream_bet_number');
                    $('.stream_bet').attr('class', 'stream_past_bet');
                }
                $('.stream_bets').prepend('<hr class="stream_bets_line">');
                if(data['hide_participate']) {
                    $('.stream_participate').css('display', '');
                    $('.stream_add_fakes').css('display', '');
                }
                $('.stream_bets_total > span').html('0');
                $('.number_won').removeClass('number_won');
                $('.stream_field_chip').remove();
                $('.stream_bets_total > span').html('0');
                showInfo(`Ставки открыты`);
                $('.stream_open_table').click();
            } else if(action == 'fake_balance') {
                if(data['is_fake']) {
                    $('.stream_fake').css('display', 'flex');
                    if(data['is_tournament']) {
                        $('.stream_fake').attr('src', `/${$('#static_url').val()}img/tournament.png`);
                        showInfo('Теперь вы играете в турнире');
                    } else {
                        $('.stream_fake').attr('src', `/${$('#static_url').val()}img/fake.png`);
                        showInfo('Теперь вы играете на фантики');
                    }
                    if(data['add_fakes']) {
                        $('.stream_add_fakes').css('display', 'flex');
                    }
                } else {
                    $('.stream_fake').css('display', '');
                    $('.stream_add_fakes').css('display', '');
                    showInfo('Теперь вы играете на реальные деньги');
                }
                changeBalance(parseInt(data['new_balance']), data['add_fakes']);
            } else if(action == 'change_tournament') {
                $('.stream_fake').css('display', 'flex');
                if(data['is_tournament']) {
                    $('.stream_fake').attr('src', `/${$('#static_url').val()}img/tournament.png`);
                    showInfo('Теперь вы играете в турнире');
                    $('.stream_participate').css('display', '');
                } else {
                    $('.stream_fake').attr('src', `/${$('#static_url').val()}img/fake.png`);
                    showInfo('Теперь вы играете на фантики');
                    if(data['participate']) {
                        $('.stream_participate').css('display', 'block');
                    }
                }
                if(data['add_fakes']) {
                    $('.stream_add_fakes').css('display', 'flex');
                } else {
                    $('.stream_add_fakes').css('display', '');
                }
            } else if(action == 'undo_spin') {
                bets = data['bets'];
                bets_amounts = data['bets_amounts'];
                last_spin = data['last_spin'];
                total_amount = data['total_amount'];
                $('.stream_clear').removeClass('disabled');
                $('.stream_favorites').removeClass('disabled');
                $('.stream_reset_bets').removeClass('disabled');
                $('.stream_spin').removeClass('disabled');
                $('.stream_double').removeClass('disabled');
                status = 'open';
                showInfo('Подтверждение ставок отменено');
                $('.stream_spin').css('display', '');
                $('.stream_undo_spin').css('display', 'none');
            } else if(action == 'change_spin_result') {
                if('new_balance' in Object.keys(data)) {
                    changeBalance(parseInt(data['new_balance']), data['add_fakes']);
                }
                $(`.stream_number_${data['spin_pk']}`).html(data['new_number']);
                $(`.stream_number_${data['spin_pk']}`).attr('class', `stream_number ${data['color']} stream_number_${data['spin_pk']}`);
                let phrase = `Результат спина ${data['spin_pk']} был изменён с ${data['old_number']} на ${data['new_number']}`;
                showInfo(phrase);
            } else if(action == 'cancel_spin_result') {
                if('new_balance' in Object.keys(data)) {
                    changeBalance(parseInt(data['new_balance']), data['add_fakes']);
                }
                $(`.stream_number_${data['spin_pk']}`).addClass('spin_cancelled');
                let phrase = `Спин ${data['spin_pk']} был отменён`;
                showInfo(phrase);
            } else if(action == 'start_tournament') {
                if(data['status']) {
                    showInfo('Турнир начался. Вы участвуете в турнире.');
                } else {
                    $('.stream_participate').css('display', 'block');
                    showInfo('Турнир начался. Нажмите на звёздочку в левом верхнем углу, чтобы принять участие.');
                }
            } else if(action == 'end_tournament') {
                $('.stream_fake').attr('src', `/${$('#static_url').val()}img/fake.png`);
                if(balance == 0) {
                    $('.stream_add_fakes').css('display', 'flex');
                }
                $('.stream_participate').css('display', '');
                let phrase;
                if(Object.keys(data).includes('winner')) {
                    phrase = `Турнир окончен, победитель: ${data['winner']}`;
                } else {
                    phrase = `Турнир окончен, вы заняли ${data['place']} место и выиграли ${data['win']}`;
                    $('.stream_system_balance').html(data['system_balance']);
                }
                showInfo(phrase);
            } else if(action == 'allow_undo') {
                $('.stream_spin').css('display', 'none');
                $('.stream_undo_spin').css('display', '');
            } else if(action == 'forbid_undo') {
                $('.stream_spin').css('display', '');
                $('.stream_undo_spin').css('display', 'none');
            } else if(action == 'close_bets_timeout') {
                let time = parseInt(data['time']);
                setCloseBetsTimeouts(time);
            } else if(action == 'close_bets_timeout_cancel') {
                window.clearInterval(close_bets_interval);
                $('.stream_timeout').css('display', '');
            } else if(action == 'change_system_balance') {
                $('.stream_system_balance').html(data['system_balance']);
            } else if(action == 'cancel_ezugi_spin') {
                showInfo('По техническим причинам результат спина был отменён');
            }
        };

        userSocket.onclose = (e) => {
            console.log('connection closed')
            openSocket();
        }

        userSocket.onerror = (e) => {
        }
    }

    // document.fullscreenEnabled = document.fullscreenEnabled || document.mozFullScreenEnabled || document.documentElement.webkitRequestFullScreen;

    // function requestFullscreen(element) {
    //     if (element.requestFullscreen) {
    //         element.requestFullscreen();
    //     } else if (element.mozRequestFullScreen) {
    //         element.mozRequestFullScreen();
    //     } else if (element.webkitRequestFullScreen) {
    //         element.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    //     }
    // }

    // if(document.fullscreenEnabled) {
    //     requestFullscreen(document.documentElement);
    // }

    function enableUser(data) {
        $('.stream_ask_block').css('display', '');
        $('.stream_open_table').click();
        $('.stream_summary_block').css('visibility', 'visible');
        $('.stream_buttons_block').css('visibility', 'visible');
        $('.stream_bets_total').css('display', 'flex');
        $('.stream_table_maximum_block').css('display', 'flex');
        $('.stream_bets').css('display', 'flex');

        if(data['participate']) {
            $('.stream_participate').css('display', 'block');
        }

        if($('.stream_timeout_value').length > 0) {
            let time = parseInt($('.stream_timeout_value').val());
            setCloseBetsTimeouts(time);
        }

        if(data['undo_spin']) {
            $('.stream_spin').css('display', 'none');
            $('.stream_undo_spin').css('display', '');
        } else {
            $('.stream_spin').css('display', '');
            $('.stream_undo_spin').css('display', 'none');
        }

        if(data['is_fake']) {
            if(data['is_tournament']) {
                $('.stream_fake').attr('src', `/${$('#static_url').val()}img/tournament.png`);
                showInfo('Вы подключены к данной игре. Вы играете в турнире');
            } else {
                $('.stream_fake').attr('src', `/${$('#static_url').val()}img/fake.png`);
                showInfo('Вы подключены к данной игре. Вы играете на фантики');
            }
            if(data['add_fakes']) {
                $('.stream_add_fakes').css('display', 'flex');
            }
            $('.stream_fake').css('display', 'flex');
        } else {
            showInfo(`Вы подключены к данной игре`);
        }
        $('.stream_resume').remove();
        balance = data['balance'];
        $('.stream_balance').html(balance);
        if(data['status'] != 'open' || data['closed']) {
            $('.stream_clear').addClass('disabled');
            $('.stream_favorites').addClass('disabled');
            $('.stream_reset_bets').addClass('disabled');
            $('.stream_repeat').addClass('disabled');
            $('.stream_spin').addClass('disabled');
            $('.stream_double').addClass('disabled');
        } else if(Object.keys(bets).length == 0) {
            $('.stream_spin').addClass('disabled');
        }

        if($('.stream_chips_block > .stream_chip').length > 1) {
            $('.stream_chips_block > .stream_chip:first-child').addClass('stream_chip_selected');
            chip_id = $('.stream_chip_selected').attr('class').replace(/[a-z_ ]+/g, '');
            chip_value = chip_values[chip_id];
        }
        status = data['closed'] ? 'closed' : data['status'];

        let amount = 0;
        for(let spin of data['spins']) {
            for(let bet of spin.bets) {
                let bet_type = bet.bet;
                let bet_field_id = bet.bet;
                if(bet.numbers.length > 0) {
                    bet_type = `${bet.bet.replace('-', ' ')}: ${bet.numbers.replace(/_/g, ', ')}`;
                    bet_field_id = bet.numbers;
                }
                if(bet.is_set) {
                    if(bet.bet.search('track') != -1) {
                        bet_type = `neighbours: ${bet.bet.replace('track_', '')}`;
                    } else if(bet.bet == 'jeu') {
                        bet_type = 'jeu 0';
                    }
                }

                let bet_id = `${bet.pk}_${bet_field_id.replace(/ /g, '_')}`;
                let color = '';
                if(bet.result) {
                    color = ' style="color: aqua;"';
                } else if(!bet.is_placed && (status == 'waiting' || !spin.status)) {
                    color = ' style="color: red;"';
                }
                if(spin.status) {
                    $('.stream_bets').prepend(`<span class="stream_bet bet_${bet_id}"${color}>
                                                                <span class="count_${bet_id}">${bet.count}</span> X 
                                                                <span class="value_${bet_id}">${bet.value}</span> = 
                                                                <span class="amount_${bet_id}">${bet.value * bet.count}</span> на ${bet_type}
                                                            </span>`);

                    if(data['status'] != 'closed' || bet.is_placed) {                         
                        if(bets_amounts[bet_field_id] == undefined) {
                            bets_amounts[bet_field_id] = bet.count * bet.value;
                             if(bet.numbers) {
                                 borders[bet_field_id] = bet.type;
                             }
                            let value_str = convertNumberToK(bets_amounts[bet_field_id], 10);
                            $(`[id='${bet_field_id}']`).append(`<div class="stream_field_chip field_chip_${bet_field_id.replace(/ /g, '_')}">${value_str}</div>`);
                        } else {
                            bets_amounts[bet_field_id] += bet.count * bet.value;
                            let value_str = convertNumberToK(bets_amounts[bet_field_id], 10);
                            $(`.field_chip_${bet_field_id.replace(/ /g, '_')}`).html(value_str);
                        }
                        amount += bet.value * bet.count;
                    }
                } else {
                    $('.stream_bets').prepend(`<span class="stream_past_bet"${color}>
                                                                <span>${bet.count}</span> X 
                                                                <span>${bet.value}</span> = 
                                                                <span>${bet.value * bet.count}</span> на ${bet_type}
                                                            </span>`);

                }
            }
            if(spin.number != undefined) {
                let bets_class = spin.status ? 'stream_bet' : 'stream_past_bet';
                $('.stream_bets').prepend(`<span class="${bets_class} stream_bet_number">Число: ${spin.number}</span>`);
                $('.stream_bets').prepend(`<span class="${bets_class}">Ставки: ${spin.total}</span>`);
                $('.stream_bets').prepend(`<span class="${bets_class}">Результат: <span class="stream_bets_change${spin.difference < 0 ? ' negative' : ''}">${spin.difference >= 0 ? '+' : ''}${spin.difference}</span></span>`);
                $('.stream_bets').prepend('<hr class="stream_bets_line">');
            }
        }
        if(status != 'open') {
            $('.stream_bets_line:first-child').remove();
        }
        if(status == 'waiting') {
            $('.stream_field_chip').css('display', 'none');
            amount = 0;
        }
        bets_amounts = {};
        $('.stream_bets_total > span').html(amount);
    }

    function streamFinished() {
        let seconds = 5;
        $('.stream_info_content').css('display', '');
        $('.stream_info_content').html(`Стрим окончен. Вы будете автоматически перенаправлены через <span class="stream_ended_seconds">${seconds}</span> с.`);
        $('.stream_bets').html('');
        $('.stream_bets_total').html('');
        window.setInterval(() => {
            seconds -= 1;
            $('.stream_ended_seconds').html(seconds);
            if(seconds == 0) {
                window.location.href = window.location.origin + '/user_page/';
            }
        }, 1000);
    }

    // $(document).on('click', '.stream_resume', () => {
    //     resume();
    // })

    $(document).on('click', '.stream_ask', () => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/ask/",
            data: {admin_pk: admin_id, csrfmiddlewaretoken: token},
            success: (data) => {
                if(data['result'] == 'failed') {
                    streamFinished();
                }
            },
            error: (data) => {
            }
        });
    })

    $(document).on('click', '.stream_chips_block > .stream_chip', (e) => {
        if(!chip_lock) {
            $('.stream_chip_selected').removeClass('stream_chip_selected');
            e.target.classList.add('stream_chip_selected');
            if(e.target.classList.contains('stream_erase')) {
                chip_id = undefined;
                chip_value = undefined;
                erase = true;
            } else {
                chip_id = e.target.classList[1].replace(/[a-z_]+/g, '');
                chip_value = chip_values[chip_id];
                erase = false;
            }
        }
    })

    $('.num').on('mouseover', (e) => {
        if(status == 'open') {
            e.target.classList.add('hover');
        }
    })

    $(document).on('mouseover', '.stream_number', (e) => {
        if(status == 'open') {
            e.target.classList.add('hover');
        }
    })

    $('.sector').on('mouseover', (e) => {
        if(status == 'open') {
            $(`.${e.target.id.replace(/ /g, '_').toLowerCase()}`).addClass('hover');
        }
    })

    $('.border').on('mouseover', (e) => {
        if(status == 'open') {
            let numbers = e.target.id.split('_');
            for(let number of numbers) {
                $(`#${number}`).addClass('hover');
            }
        }
    })

    $('.track_num').on('mouseover', (e) => {
        if(status == 'open') {
            let target = e.target;
            let number_id = track_data.indexOf(target.id.replace('track_', ''), 2);
            for(let i = -2; i <= 2; i++) {
                $(`#track_${track_data[number_id + i]}`).addClass('hover');
            }
        }
    })

    $('.track_sector').on('mouseover', (e) => {
        if(status == 'open') {
            $(`.${e.target.id}`).addClass('hover');
        }
    })

    $('.num').on('mouseout', () => {
        $('.hover').removeClass('hover');
    })

    $(document).on('mouseout', '.stream_number', () => {
        $('.hover').removeClass('hover');
    })

    $('.sector').on('mouseout', () => {
        $('.hover').removeClass('hover');
    })

    $('.border').on('mouseout', () => {
        $('.hover').removeClass('hover');
    })

    $('.track_num').on('mouseout', () => {
        $('.hover').removeClass('hover');
    })

    $('.track_sector').on('mouseout', () => {
        $('.hover').removeClass('hover');
    })

    function bet(bet, border=undefined, chip_count=1) {
        if(total_amount + (chip_value * chip_count) <= balance && total_amount + (chip_value * chip_count) <= table_maximum && status == 'open' && !field_lock) {
            field_lock = true;
            chip_lock = true;

            if(bets[bet] != undefined && bets[bet][chip_id] != undefined) {
                bets[bet][chip_id] += chip_count;
            } else if(bets[bet] != undefined) {
                bets[bet][chip_id] = chip_count;
            } else {
                bets[bet] = {};
                bets[bet][chip_id] = chip_count;
            }
            total_amount += chip_value * chip_count;
            
            if(bets_amounts[bet] == undefined) {
                bets_amounts[bet] = chip_value * chip_count;
                let value_str = convertNumberToK(bets_amounts[bet], 10);
                $(`[id='${bet}']`).append(`<div class="stream_field_chip field_chip_${bet.replace(/ /g, '_')}">${value_str}</div>`);
                if($('.track').css('flex-direction') == 'row-reverse' && (Object.keys(track_reverse_css).includes(bet))) {
                    $(`#${bet} > .stream_field_chip`).css(track_reverse_css[bet]);
                }
            } else {
                bets_amounts[bet] += chip_value * chip_count;
                let value_str = convertNumberToK(bets_amounts[bet], 10);
                $(`.field_chip_${bet.replace(/ /g, '_')}`).html(value_str);
            }
            
            let count = bets[bet][chip_id];
            let bet_id = `${chip_id}_${bet.replace(/ /g, '_')}`;
            order.push({'chip_id': chip_id, 'chip_value': chip_value, 'bet': bet, 'chip_count': chip_count});
            $('.stream_bets_total > span').html(total_amount);
            if($(`.bet_${bet_id}`).length == 0) {
                let bet_type = bet;
                if(border != undefined) {
                    bet_type = `${border.replace('-', ' ')}: ${bet.replace(/_/g, ', ')}`;
                    borders[bet] = border;
                }
                if(bet.search('track') != -1) {
                    bet_type = `neighbours: ${bet.replace('track_', '')}`;
                }
                if(bet == 'jeu') {
                    bet_type = 'jeu 0';
                }
                $('.stream_bets').prepend(`<span class="stream_bet bet_${bet_id}">
                                                    <span class="count_${bet_id}">${chip_count}</span> X 
                                                    <span class="value_${bet_id}">${chip_value}</span> = 
                                                    <span class="amount_${bet_id}">${chip_value * chip_count}</span> на ${bet_type}
                                                </span>`);
            } else {
                $(`.count_${bet_id}`).html(count);
                $(`.amount_${bet_id}`).html(chip_value * count);
                $(`.count_${bet_id}`).css('color', 'aqua');
                $(`.amount_${bet_id}`).css('color', 'aqua');
                colorTimeout = window.setTimeout(() => {
                    $(`.count_${bet_id}`).css('color', '');
                    $(`.amount_${bet_id}`).css('color', '');
                }, 2000);
            }
            $('.stream_repeat').addClass('disabled');
            $('.stream_spin').removeClass('disabled');
            chip_lock = false;
            field_lock = false;
        } else if(total_amount + (chip_value * chip_count) >= balance) {
            $('.stream_balance').css('color', 'red');
            window.setTimeout(() => {
                $('.stream_balance').css('color', '');
            }, 2000)
            showInfo(`У вас недостаточно средств`);
        } else if(total_amount + (chip_value * chip_count) > table_maximum) {
            showInfo(`Максимум стола: ${table_maximum}`);
        }
    }

    function eraseBet(bet_to_erase) {
        let count;
        if(bets[bet_to_erase.bet][bet_to_erase.chip_id] == bet_to_erase.chip_count) {
            delete bets[bet_to_erase.bet][bet_to_erase.chip_id];
            if(Object.keys(bets[bet_to_erase.bet]).length == 0) {
                delete bets[bet_to_erase.bet];
            }
            count = undefined;
        } else {
            bets[bet_to_erase.bet][bet_to_erase.chip_id] -= bet_to_erase.chip_count;
            count = bets[bet_to_erase.bet][bet_to_erase.chip_id];
        }
        total_amount -= bet_to_erase.chip_value * bet_to_erase.chip_count;

        if(bets_amounts[bet_to_erase.bet] == bet_to_erase.chip_value * bet_to_erase.chip_count) {
            delete bets_amounts[bet_to_erase.bet];
            $(`.field_chip_${bet_to_erase.bet.replace(/ /g, '_')}`).remove();
        } else {
            bets_amounts[bet_to_erase.bet] -= bet_to_erase.chip_value * bet_to_erase.chip_count;
            let value_str = convertNumberToK(bets_amounts[bet_to_erase.bet], 10);
            $(`.field_chip_${bet_to_erase.bet.replace(/ /g, '_')}`).html(value_str);
        }

        let bet_id = `${bet_to_erase.chip_id}_${bet_to_erase.bet.replace(/ /g, '_')}`;
        $('.stream_bets_total > span').html(total_amount);
        if(count == undefined) {
            $(`.bet_${bet_id}`).remove();
        } else {
            $(`.count_${bet_id}`).html(count);
            $(`.amount_${bet_id}`).html(bet.chip_value * count);
            $(`.count_${bet_id}`).css('color', 'red');
            $(`.amount_${bet_id}`).css('color', 'red');
            colorTimeout = window.setTimeout(() => {
                $(`.count_${bet_id}`).css('color', '');
                $(`.amount_${bet_id}`).css('color', '');
            }, 2000);
        }
        if(total_amount == 0 && last_spin > 0 && last_spin <= balance) {
            $('.stream_repeat').removeClass('disabled');
        }
        if(Object.keys(bets).length == 0) {
            $('.stream_spin').addClass('disabled');
        }
    }

    function eraseBetWrapper(bet_type) {
        if(!field_lock) {
            field_lock = true;
            let bet_index;
            for(let i = order.length - 1; i >= 0; i--) {
                if(order[i]['bet'] == bet_type) {
                    bet_index = i;
                    break;
                }
            }

            if(bet_index != undefined) {
                let bet_to_erase = order[bet_index];
                order.splice(bet_index, 1);
                eraseBet(bet_to_erase);
            }
            field_lock = false
        }
    }

    $('.num').on('click', (e) => {
        if(e.target.classList[0] != 'border' && e.target.parentElement.classList[0] != 'border') {
            if(!erase) {
                let current = bets_amounts[e.target.id] == undefined ? 0 : bets_amounts[e.target.id];
                if(current + chip_value <= number_maximum) {
                    bet(e.target.id);
                } else if(chip_value == undefined) {
                    let phrase = `Выберите фишку, чтобы сделать ставку`;
                    showInfo(phrase);
                } else {
                    let phrase = `Превышен максимум в номер: ${number_maximum}`;
                    showInfo(phrase);
                }
            } else {
                eraseBetWrapper(e.target.id);
            }
        }
    })

    $('.sector').on('click', (e) => {
        if(!erase) {
            let pk = e.target.id;
            let count = 1;
            let current = bets_amounts[pk] == undefined ? 0 : bets_amounts[pk];
            let coefficient = ['Red', 'Black', 'Odd', 'Even', '1 to 18', '19 to 36'].includes(pk) ? 18 : 12;
            if(current + chip_value <= number_maximum * coefficient) {
                if(bets[pk] == undefined) {
                    if(['Red', 'Black', 'Odd', 'Even', '1 to 18', '19 to 36'].includes(pk)) {
                        count = Math.ceil(minimum_50 / chip_value);
                    } else {
                        count = Math.ceil(minimum_33 / chip_value);
                    }
                };
                bet(pk, undefined, count);
            } else if(chip_value == undefined) {
                let phrase = `Выберите фишку, чтобы сделать ставку`;
                showInfo(phrase);
            } else {
                let phrase = `Попытка превысить максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
        } else {
            eraseBetWrapper(e.target.id);
        }
    })

    $('.border').on('click', (e) => {
        if(!erase) {
            let pk = e.target.classList[1];
            let coefficient = 2;
            let current = bets_amounts[e.target.id] == undefined ? 0 : bets_amounts[e.target.id];
            if(pk == 'six-line') {
                coefficient = 6;
            } else if(['basket', 'street'].includes(pk)) {
                coefficient = 3;
            } else if(['first-four', 'corner'].includes(pk)) {
                coefficient = 4;
            }

            if(current + chip_value <= number_maximum * coefficient) {
                bet(e.target.id, pk);
            } else if(chip_value == undefined) {
                let phrase = `Выберите фишку, чтобы сделать ставку`;
                showInfo(phrase);
            } else {
                let phrase = `Попытка превысить максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
        } else {
            eraseBetWrapper(e.target.id);
        }
    })

    $('.track_num').on('click', (e) => {
        if(!erase) {
            let current = bets_amounts[e.target.id] == undefined ? 0 : bets_amounts[e.target.id];
            let count = current == 0 && chip_value < 5 ? Math.ceil(5 / chip_value) : 1;
            if(current + 5 * count * chip_value <= number_maximum * 5) {
                bet(e.target.id, undefined, 5 * count);
            } else if(chip_value == undefined) {
                let phrase = `Выберите фишку, чтобы сделать ставку`;
                showInfo(phrase);
            } else {
                let phrase = `Попытка превысить максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
        } else {
            eraseBetWrapper(e.target.id);
        }
    })

    $('.track_sector').on('click', (e) => {
        if(!erase) {
            let target = e.target.id;
            let count;
            let coefficient = 2;
            let current = bets_amounts[target] == undefined ? 0 : bets_amounts[target];

            if (target == 'jeu') {
                count = 4;
                coefficient = 1;
            } else if (target == 'voisins') {
                count = 9;
            } else if (target == 'orphelins') {
                count = 5;
                coefficient = 1;
            } else if (target == 'tiers') {
                count = 6;
            }

            let found = true;
            if(count * chip_value % 5 != 0) {
                let x = 2;
                found = false;
                while(x * count * chip_value <= (balance - total_amount)) {
                    x++;
                    if(x * count * chip_value % 5 == 0) {
                        found = true;
                        count = count * x;
                        break;
                    }
                }
                if(found) {
                    showInfo(`Ставки на треке должны быть кратны 5`);
                } else if(chip_value != undefined) {
                    showInfo(`Ставки на треке должны быть кратны 5. Невозможно сделать ставку с вашим текущим балансом и выбранной фишкой`);
                }
            }

            if(found && current + chip_value <= number_maximum * coefficient * count) {
                bet(target, undefined, count);
            } else if(chip_value == undefined) {
                let phrase = `Выберите фишку, чтобы сделать ставку`;
                showInfo(phrase);
            } else if(found) {
                let phrase = `Попытка превысить максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
        } else {
            eraseBetWrapper(e.target.id);
        }
    })

    $('.stream_clear').on('click', (e) => {
        if(order.length > 0 && !e.target.classList.contains('disabled') && !field_lock) {
            field_lock = true;
            let bet = order.pop();
            if(bet == 'repeat') {
                $('.stream_reset_bets').click();
            } else if(Object.keys(bet).includes('double_id')) {
                let double_id = bet['double_id'];
                eraseBet(bet);
                for(let i = order.length; i > 0; i--) {
                    bet = order.pop();
                    if(Object.keys(bet).includes('double_id') && bet['double_id'] == double_id) {
                        eraseBet(bet);
                    } else {
                        order.push(bet);
                        break;
                    }
                }
            } else {
                eraseBet(bet);
            }
            if(total_amount == 0 && last_spin > 0 && last_spin <= balance) {
                $('.stream_repeat').removeClass('disabled');
            }
            if(Object.keys(bets).length == 0) {
                $('.stream_spin').addClass('disabled');
            }
            field_lock = false;
        }
    })

    $('.stream_reset_bets').on('click', (e) => {
        if(!e.target.classList.contains('disabled')) {
            $('.stream_field_chip').remove();
            $('.stream_bet').remove();
            $('.stream_bets_total > span').html('0');
            bets = {};
            bets_amounts = {};
            order = [];
            total_amount = 0;
            if(last_spin > 0 && last_spin <= balance) {
                $('.stream_repeat').removeClass('disabled');
            }
            $('.stream_spin').addClass('disabled');
            showInfo(`Ставки сброшены`);
        }
    })

    function getCoefficient(type) {
        let coefficient_data = {
            'jeu': 4,
            'voisins': 18,
            'orphelins': 5,
            'tiers': 12,
            'corner': 4,
            'split': 2,
            'six-line': 6,
            'street': 3,
            'basket': 3,
            'first-four': 4
        }
        let coefficient = 1;
        if(Object.keys(coefficient_data).includes(type)) {
            coefficient = coefficient_data[type];
        } else if(['Red', 'Black', 'Odd', 'Even', '1 to 18', '19 to 36'].includes(type)) {
            coefficient = 18;
        } else if(['1st 12', '2nd 12', '3rd 12', '1st column', '2nd column', '3rd column'].includes(type)) {
            coefficient = 12;
        } else if(type.search('track_') != -1) {
            coefficient = 5;
        }
        return coefficient;
    }

    $('.stream_repeat').on('click', (e) => {
        if(last_spin <= balance && last_spin <= table_maximum && !e.target.classList.contains('disabled') && !field_lock && last_spin > 0) {
            field_lock = true;
            const token = $('input[name=csrfmiddlewaretoken]').val();
            $.ajax({
                method: "post",
                url: "/user_page/repeat/",
                data: {admin_id: admin_id, csrfmiddlewaretoken: token},
                success: (data) => {
                    if(data['result'] == 'ok') {
                        let more = false;
                        for(let bet of data['bets']) {
                            let coefficient = getCoefficient(bet.bet);
                            if(bet.count * bet.value <= number_maximum * coefficient) {
                                let bet_field = bet.bet;
                                let bet_id = `${bet.pk}_${bet.bet.replace(/ /g, '_')}`;
                                let bet_type = bet.bet;
                                if(bet.numbers.length > 0) {
                                    bet_field = bet.numbers;
                                    bet_id = `${bet.pk}_${bet_type}`;
                                    bet_type = `${bet.bet.replace('-', ' ')}: ${bet_field.replace(/_/g, ', ')}`;
                                    borders[bet_field] = bet.bet;
                                }
                                if(bet.bet.search('track') != -1) {
                                    bet_type = `neighbours: ${bet.bet.replace('track_', '')}`;
                                } else if(bet.bet == 'jeu') {
                                    bet_type = 'jeu 0';
                                }

                                let amount = bet.count * bet.value;
                                
                                if(!Object.keys(bets).includes(bet_field)) {
                                    bets[bet_field] = {};
                                }
                                if(!Object.keys(bets[bet_field]).includes(`${bet.pk}`)) {
                                    bets[bet_field][bet.pk] = 0;
                                }
                                bets[bet_field][bet.pk] += bet.count;

                                order.push({'chip_id': bet.pk, 'chip_value': bet.value, 'bet': bet_field, 'chip_count': bet.count});

                                total_amount += amount;
                                
                                if(bets_amounts[bet_field] == undefined) {
                                    bets_amounts[bet_field] = amount;
                                } else {
                                    bets_amounts[bet_field] += amount;
                                }
                                let value_str = convertNumberToK(bets_amounts[bet_field], 10);
                                $(`[id='${bet_field}']`).append(`<div class="stream_field_chip field_chip_${bet_field.replace(/ /g, '_')}">${value_str}</div>`);
                                
                                $('.stream_bets').prepend(`<span class="stream_bet bet_${bet_id}">
                                                                    <span class="count_${bet_id}">${bet.count}</span> X 
                                                                    <span class="value_${bet_id}">${bet.value}</span> = 
                                                                    <span class="amount_${bet_id}">${amount}</span> на ${bet_type}
                                                                </span>`);
                            } else {
                                more = true;
                            }
                        }
                        if(more) {
                            let phrase = `Некоторые ставки не были сделаны, так как максимум в номер был изменён: ${number_maximum}`;
                            showInfo(phrase);
                        }
                        $('.stream_bets_total > span').html(total_amount);
                        order.push('repeat');
                        e.target.classList.add('disabled');
                        $('.stream_spin').removeClass('disabled');
                    } else if(data['result'] == 'failed') {
                        streamFinished();
                    } else if(data['result'] == 'amount') {
                        console.log('not today');
                        $('.stream_reset_bets').click();
                    }
                    field_lock = false;
                },
                error: (data) => {
                }
            });
        } else if(last_spin > balance) {
            $('.stream_balance').css('color', 'red');
            window.setTimeout(() => {
                $('.stream_balance').css('color', '');
            }, 2000)
            showInfo(`У вас недостаточно средств`);
        } else if(!e.target.classList.contains('disabled') && last_spin <= table_maximum) {
            showInfo(`Максимум стола: ${table_maximum}`);
        }
    })

    $('.stream_double').on('click', (e) => {
        if(total_amount * 2 <= balance && total_amount * 2 <= table_maximum && !e.target.classList.contains('disabled') && !field_lock) {
            field_lock = true;
            let more = false;
            for(let bet of Object.keys(bets)) {
                let type = bet;
                if(Object.keys(borders).includes(bet)) {
                    type = borders[bet];
                }
                let coefficient = getCoefficient(type);
                if(bets_amounts[bet] * 2 > number_maximum * coefficient) {
                    more = true;
                    break;
                }
            }
            if(!more) {
                total_amount *= 2;
                $('.stream_bets_total > span').html(total_amount);
                let double_id = new Date().getTime();
                for(let [bet, chips] of Object.entries(bets)) {
                    bets_amounts[bet] *= 2;
                    for(let chip of Object.keys(chips)) {
                        let initial_count = bets[bet][chip];
                        bets[bet][chip] *= 2;
                        let value_str = convertNumberToK(bets_amounts[bet], 10);
                        let bet_str = bet.replace(/ /g, '_');
                        $(`.field_chip_${bet_str}`).html(value_str);

                        let count = bets[bet][chip];
                        let bet_id = `${chip}_${bet_str}`;
                        
                        $(`.count_${bet_id}`).html(count);
                        $(`.amount_${bet_id}`).html(parseInt($(`.amount_${bet_id}`).html()) * 2);
                        $(`.count_${bet_id}`).css('color', 'aqua');
                        $(`.amount_${bet_id}`).css('color', 'aqua');
                        colorTimeout = window.setTimeout(() => {
                            $(`.count_${bet_id}`).css('color', '');
                            $(`.amount_${bet_id}`).css('color', '');
                        }, 2000);
                    }
                }
                let double_order = [];
                for(let bet of order) {
                    double_order.push({"double_id": double_id, ...bet});
                }
                order = [...order, ...double_order];
            } else {
                let phrase = `Попытка превысить максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
            field_lock = false;
        } else if(total_amount * 2 > balance) {
            $('.stream_balance').css('color', 'red');
            window.setTimeout(() => {
                $('.stream_balance').css('color', '');
            }, 2000)
            showInfo(`У вас недостаточно средств`);
        } else if(total_amount * 2 > table_maximum) {
            showInfo(`Максимум стола: ${table_maximum}`);
        }
    })

    $(document).on('click', '.stream_spin', (e) => {
        if(!e.target.classList.contains('disabled') && !field_lock && Object.keys(bets).length > 0) {
            field_lock = true;
            const token = $('input[name=csrfmiddlewaretoken]').val();
            $.ajax({
                method: "post",
                url: "/user_page/spin/",
                data: {admin_id: admin_id, bets: JSON.stringify(bets), borders: JSON.stringify(borders), auto_spin: JSON.stringify(close_bets_auto_spin), csrfmiddlewaretoken: token},
                success: (data) => {
                    if(data['result'] == 'ok') {
                        $('.stream_clear').addClass('disabled');
                        $('.stream_favorites').addClass('disabled');
                        $('.stream_reset_bets').addClass('disabled');
                        $('.stream_spin').addClass('disabled');
                        $('.stream_repeat').addClass('disabled');
                        $('.stream_double').addClass('disabled');
                        if($('.stream_hide_table_checkbox').prop('checked')) {
                            $('.stream_bottom_arrow').click();
                        }
                        bets = {};
                        bets_amounts = {};
                        order = [];
                        if(total_amount > 0) {
                            last_spin = total_amount;
                        }
                        total_amount = 0;
                        status = 'closed';
                        showInfo(`Вы успешно подтвердили ставки`);
                        if(close_bets_auto_spin == false) {
                            $('.stream_spin').css('display', 'none');
                            $('.stream_undo_spin').css('display', '');
                        }
                        last_log = data['last_log'];
                    } else if(data['result'] == 'failed') {
                        streamFinished();
                    } else if(data['result'] == 'amount') {
                        console.log('not today');
                        $('.stream_reset_bets').click();
                    }
                    close_bets_auto_spin = false;
                    field_lock = false;
                },
                error: (data) => {
                }
            });
        }
    })

    function addFakes() {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $('.stream_add_fakes').css('display', '');
        $.ajax({
            method: "post",
            url: "/user_page/add_fakes/",
            data: {admin_id: admin_id, csrfmiddlewaretoken: token},
            success: (data) => {
                if(data['result'] == 'ok') {
                    changeBalance(parseInt(data['balance']), data['add_fakes']);
                    showInfo(`Ваш депозит увеличен на ${data['added']}`);
                    $('.stream_system_balance').html(data['system_balance']);
                } else if(data['result'] == 'failed') {
                    streamFinished();
                } else if(data['result'] == 'not enough') {
                    e.target.style.display = 'flex';
                    showInfo(`Не хватает средств. Ваш баланс: ${data['balance']}. Требуется: ${data['cost']}`);
                }
            },
            error: (data) => {
            }
        });
    }

    $(document).on('click', '.stream_add_fakes', (e) => {
        $.ajax({
            method: "get",
            url: "/user_page/add_fakes_info/",
            data: {admin_id: admin_id},
            success: (data) => {
                if(data['result'] == 'tournament') {
                    $('.stream_background').css('display', 'flex');
                    $('.stream_background > div').css('display', 'none');
                    let balance = data['balance'];
                    let cost = data['cost'];
                    $('.stream_participate_balance').html(balance);
                    $('.stream_participate_cost').html(cost);
                    if(balance >= cost) {
                        $('.stream_add_fakes_confirmation_block').css('display', 'inline-block');
                    } else {
                        $('.stream_participate_not_enough').css('display', 'inline-block');
                    }
                } else {
                    addFakes();
                }
            },
            error: (data) => {
            }
        });
    })

    $(document).on('click', '.stream_add_fakes_confirm', () => {
        $('.stream_background').css('display', '');
        $('.stream_background > div').css('display', 'none');
        addFakes();
    })

    $(document).on('click', '.stream_settings', () => {
        $('.stream_background').css('display', 'flex');
        $('.stream_background > div').css('display', 'none');
        $('.stream_settings_block').css('display', '');
    })

    $(document).on('click', '.stream_favorites', (e) => {
        if(!e.target.classList.contains('disabled')) {
            $('.stream_background').css('display', 'flex');
            $('.stream_background > div').css('display', 'none');
            $('.stream_favorites_block').css('display', '');
            if(chip_value == undefined) {
                $('.stream_favorites_notification').css('display', 'inline');
            }
        }
    })

    $(document).on('click', '.stream_background', (e) => {
        if(e.target.classList.contains('stream_background')) {
            $('.stream_background').css('display', '');
            $('.stream_background > div').css('display', '');
            $('.stream_favorites_block').css('display', '');
            $('.stream_favorites_notification').css('display', '');
            $('.stream_preset_add_block').css('display', '');
            $('.stream_preset_set_name_block').css('display', '');
            $('.stream_preset_name_input').css('border', '');
            $('.stream_preset_name_input').val('');
            $('.stream_participate_balance').html('');
            $('.stream_participate_cost').html('');
        }
    })

    $(document).on('mouseover', '.stream_complex_number', (e) => {
        if(!complex_lock && chip_value != undefined) {
            complex_lock = true;
            let mode = $('.stream_complex_select').val();
            let number = parseInt(e.target.id.replace('complex_', ''));
            let data = {};
            if(number == 0) {
                data = {
                    '0': [1, 'num'],
                    '0_1': [2, 'split'],
                    '0_3': [2, 'split'],
                    '0_2': [2, 'split']
                }
                if(mode != 'butterfly') {
                    data['0_1_2'] = [3, 'basket']
                    data['0_2_3'] = [3, 'basket']
                }
                if(mode == 'complex') {
                    data['0_1_2_3'] = [4, 'first-four']
                }
            } else {
                let column = parseInt(e.target.parentElement.id.replace('complex_', '').replace('_column', ''));
                let is_first = e.target.classList.contains('first_row');
                let is_last = e.target.classList.contains('last_row');
                if(column == 1) {
                    data[`${number}_${number + 1}`] = [2, 'split'];

                    if(mode == 'complex') {
                        data[`${number}_${number + 1}_${number + 2}`] = [3, 'street'];
                        
                        if(!is_first) {
                            data[`${number - 3}_${number - 2}_${number - 1}_${number}_${number + 1}_${number + 2}`] = [6, 'six-line'];
                        }

                        if(!is_last) {
                            data[`${number}_${number + 1}_${number + 2}_${number + 3}_${number + 4}_${number + 5}`] = [6, 'six-line'];
                        }
                    }
                } else if(column == 2) {
                    data[`${number - 1}_${number}`] = [2, 'split'];
                    data[`${number}_${number + 1}`] = [2, 'split'];

                    if(mode == 'complex') {
                        data[`${number - 1}_${number}_${number + 1}`] = [3, 'street'];

                        if(!is_first) {
                            data[`${number - 4}_${number - 3}_${number - 2}_${number - 1}_${number}_${number + 1}`] = [6, 'six-line'];
                        }

                        if(!is_last) {
                            data[`${number - 1}_${number}_${number + 1}_${number + 2}_${number + 3}_${number + 4}`] = [6, 'six-line'];
                        }
                    }
                } else if(column == 3) {
                    data[`${number - 1}_${number}`] = [2, 'split'];

                    if(mode == 'complex') {
                        data[`${number - 2}_${number - 1}_${number}`] = [3, 'street'];

                        if(!is_first) {
                            data[`${number - 5}_${number - 4}_${number - 3}_${number - 2}_${number - 1}_${number}`] = [6, 'six-line'];
                        }

                        if(!is_last) {
                            data[`${number - 2}_${number - 1}_${number}_${number + 1}_${number + 2}_${number + 3}`] = [6, 'six-line'];
                        }
                    }
                }

                data[`${number}`] = [1, 'num'];

                if(!is_first) {
                    data[`${number - 3}_${number}`] = [2, 'split'];
                }
                if(!is_last) {
                    data[`${number}_${number + 3}`] = [2, 'split'];
                }
                if(mode != 'butterfly') {
                    if(column != 1 && !is_first) {
                        data[`${number - 4}_${number - 3}_${number - 1}_${number}`] = [4, 'corner'];
                    }
                    if(column != 1 && !is_last) {
                        data[`${number - 1}_${number}_${number + 2}_${number + 3}`] = [4, 'corner'];
                    }
                    if(column != 3 && !is_first) {
                        data[`${number - 3}_${number - 2}_${number}_${number + 1}`] = [4, 'corner'];
                    }
                    if(column != 3 && !is_last) {
                        data[`${number}_${number + 1}_${number + 3}_${number + 4}`] = [4, 'corner'];
                    }
                }

                if(number == 1) {
                    data['0_1'] = [2, 'split'];
                    if(mode != 'butterfly') {
                        data['0_1_2'] = [3, 'basket'];
                    }
                    if(mode == 'complex') {
                        data['0_1_2_3'] = [4, 'first-four'];
                    }
                } else if(number == 2) {
                    data['0_2'] = [2, 'split'];
                    if(mode != 'butterfly') {
                        data['0_1_2'] = [3, 'basket'];
                        data['0_2_3'] = [3, 'basket'];
                    }
                    if(mode == 'complex') {
                        data['0_1_2_3'] = [4, 'first-four'];
                    }
                } else if(number == 3) {
                    data['0_3'] = [2, 'split'];
                    if(mode != 'butterfly') {
                        data['0_2_3'] = [3, 'basket'];
                    }
                    if(mode == 'complex') {
                        data['0_1_2_3'] = [4, 'first-four'];
                    }
                }
            }

            for(let [type, data_list] of Object.entries(data)) {
                let current = bets_amounts[type] == undefined ? 0 : bets_amounts[type];
                $(`#${type}`).append(`<div class="stream_chip_favorites">${convertNumberToK(data_list[0] * chip_value + current)}</div>`)
            }

            complex_data = {...data};
            complex_lock = false;
        }
    })

    $(document).on('mouseout', '.stream_complex_number', () => {
        complex_data = {};
        $('.stream_chip_favorites').remove();
    })

    $(document).on('click', '.stream_complex_number', (e) => {
        if(!complex_lock && status == 'open' && chip_id != undefined) {
            complex_lock = true;
            $('.stream_chip_favorites').remove();
            let more = false;
            for(let [type, data] of Object.entries(complex_data)) {
                current = bets_amounts[type] == undefined ? 0 : bets_amounts[type];
                if(current + (chip_value * data[0]) <= number_maximum * data[0]) { 
                    if(data[1] == 'num') {
                        bet(type);
                    } else {
                        bet(type, data[1], data[0]);
                    }
                } else {
                    more = true;
                }
            }
            if(more) {
                let phrase = `Некоторые ставки не были сделаны, так как превысили бы максимум в номер: ${number_maximum}`;
                showInfo(phrase);
            }
            complex_lock = false;
        }
    })

    $(document).on('click', '.stream_preset_show', (e) => {
        let id = e.target.id.replace('preset_show_', '');
        $(`#preset_hidden_${id}`).css('display', 'flex');
        $(`#preset_hide_${id}`).css('display', 'block');
        e.target.style.display = 'none';
    })

    $(document).on('click', '.stream_preset_hide', (e) => {
        let id = e.target.id.replace('preset_hide_', '');
        $(`#preset_hidden_${id}`).css('display', '');
        $(`#preset_show_${id}`).css('display', '');
        e.target.style.display = '';
    })

    $(document).on('click', '.stream_preset_add', (e) => {
        if(Object.keys(bets).length > 0) {
            $('.stream_preset_add_block').css('display', 'none');
            $('.stream_preset_set_name_block').css('display', 'flex');
        }
    })

    $(document).on('keydown', '.stream_preset_name_input', (e) => {
        if(e.keyCode == 13) {
            let name = e.target.value;
            if(name) {
                e.target.style.border = '';
                const token = $('input[name=csrfmiddlewaretoken]').val();
                $.ajax({
                    method: "post",
                    url: "/user_page/create_preset/",
                    data: {name: name, bets: JSON.stringify(bets), borders: JSON.stringify(borders), csrfmiddlewaretoken: token},
                    success: (data) => {
                        let pk = data['pk'];
                        let html_string = `<div class="stream_preset_block" id="preset_${pk}">
                                            <div class="stream_preset_visible">
                                                <div class="stream_preset_name">${name}</div>
                                                <div class="stream_preset_buttons">
                                                    <img src="/${$('#static_url').val()}img/preset_bet.svg" class="stream_preset_bet" id="preset_bet_${pk}">
                                                    <img src="/${$('#static_url').val()}img/preset_show.svg" class="stream_preset_show" id="preset_show_${pk}">
                                                    <img src="/${$('#static_url').val()}img/preset_hide.svg" class="stream_preset_hide" id="preset_hide_${pk}">
                                                    <img src="/${$('#static_url').val()}img/admin_disable.svg" class="stream_preset_delete" id="preset_delete_${pk}">
                                                </div>
                                            </div>
                                            <div class="stream_preset_hidden" id="preset_hidden_${pk}">`;
						for(let [type_, value_] of Object.entries(bets)) {
                            let bet_type = type_;
                            let count = 0;
                            if(borders[type_] != undefined) {
                                bet_type = `${borders[type_].replace('-', ' ')}: ${type_.replace(/_/g, ', ')}`;
                            }
                            if(type_.search('track') != -1) {
                                bet_type = `neighbours: ${type_.replace('track_', '')}`;
                            } else if(type_ == 'jeu') {
                                bet_type = 'jeu 0';
                            }

                            for(let chip_count of Object.values(value_)) {
                                count += chip_count;
                            }
                            html_string += `<div class="stream_preset_bet"><span>${bet_type}</span><span>x${count}</span></div>`
                        }
                        html_string += '</div></div>';
                        $('.stream_presets_block').append(html_string);
                        $('.stream_preset_add_block').css('display', '');
                        $('.stream_preset_set_name_block').css('display', '');
                        $('.stream_preset_name_input').val('');
                    },
                    error: (data) => {
                    }
                });
            } else {
                e.target.style.border = '1px solid #FBEC0F';
            }
        } else if(e.keyCode == 27) {
            $('.stream_preset_add_block').css('display', '');
            $('.stream_preset_set_name_block').css('display', '');
            $('.stream_preset_name_input').css('border', '');
            $('.stream_preset_name_input').val('');
        }
    })

    $(document).on('click', '.stream_preset_delete', (e) => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        let id = e.target.id.replace('preset_delete_', '');
        $.ajax({
            method: "post",
            url: "/user_page/delete_preset/",
            data: {id: id, csrfmiddlewaretoken: token},
            success: (data) => {
                $(`#preset_${id}`).remove();
            },
            error: (data) => {
            }
        });
    })

    $(document).on('click', '.stream_preset_bet', (e) => {
        if(chip_value != undefined && !preset_lock) {
            preset_lock = true;
            let id = e.target.id.replace('preset_bet_', '');
            $.ajax({
                method: "get",
                url: "/user_page/get_preset/",
                data: {id: id},
                success: (data) => {
                    let amount = 0;
                    let borders = data['borders'];
                    let numbers = data['numbers'];
                    let sectors = data['sectors'];
                    let track = data['track'];
                    let possible = true;

                    for(let [number, count] of Object.entries(numbers)) {
                        let current = bets_amounts[number] == undefined ? 0 : bets_amounts[number];
                        if(current + chip_value * count > number_maximum) {
                            numbers[number] = Math.floor((number_maximum - current) / chip_value);
                            if(numbers[number] == 0) {
                                possible = false;
                                showInfo(`Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер: ${number_maximum}`);
                                break;
                            }
                        }
                        amount += chip_value * count;
                    }

                    if(possible) {
                        for(let [border, border_data] of Object.entries(borders)) {
                            let name = border_data['name'];
                            let count = border_data['count'];
                            let coefficient = 2;
                            let current = bets_amounts[border] == undefined ? 0 : bets_amounts[border];
                            if(name == 'six-line') {
                                coefficient = 6;
                            } else if(['basket', 'street'].includes(name)) {
                                coefficient = 3;
                            } else if(['first-four', 'corner'].includes(name)) {
                                coefficient = 4;
                            }

                            if(current + chip_value * count > number_maximum * coefficient) {
                                border_data['count'] = Math.floor((number_maximum * coefficient - current) / chip_value);
                                if(border_data['count'] == 0) {
                                    possible = false;
                                    showInfo(`Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер: ${number_maximum}`);
                                    break;
                                }
                            }
                            amount += chip_value * count;
                        }
                    }

                    if(possible) {
                        for(let [sector, count] of Object.entries(sectors)) {
                            let current = bets_amounts[sector] == undefined ? 0 : bets_amounts[sector];
                            let coefficient = ['Red', 'Black', 'Odd', 'Even', '1 to 18', '19 to 36'].includes(sector) ? 18 : 12;
                            let minimum = coefficient == 18 ? minimum_50 : minimum_33;
                            if(current + chip_value * count > number_maximum * coefficient) {
                                sectors[sector] = Math.floor((number_maximum * coefficient - current) / chip_value);
                                if(current + sectors[sector] * chip_value < minimum) {
                                    possible = false;
                                    showInfo('Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер, либо не достугнут минимум для ставки в сектор');
                                    break;
                                }
                            } else if(current + count * chip_value < minimum) {
                                sectors[sector] = Math.ceil(minimum / chip_value);
                                if(current + chip_value * sectors[sector] > number_maximum * coefficient) {
                                    possible = false;
                                    showInfo('Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер, либо не достугнут минимум для ставки в сектор');
                                    break;
                                }
                            }
                            if(sectors[sector] == 0) {
                                possible = false;
                                showInfo(`Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер: ${number_maximum}`);
                                break;
                            }
                            amount += chip_value * count;
                        }
                    }

                    if(possible) {
                        for(let [track_bet, count] of Object.entries(track)) {
                            if(track_bet.search('track') != -1 || track_bet == 'orphelins') {
                                let current = bets_amounts[track_bet] == undefined ? 0 : bets_amounts[track_bet];
                                if(current + chip_value * count > number_maximum * 5) {
                                    track[track_bet] = Math.floor((number_maximum * 5 - current) / (chip_value * 5));
                                    if(track[track_bet] == 0) {
                                        possible = false;
                                        showInfo(`Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер: ${number_maximum}`);
                                        break;
                                    }
                                }
                            } else {
                                let coefficient = 1;
                                let current = bets_amounts[track_bet] == undefined ? 0 : bets_amounts[track_bet];
                                let potential_count = count;
                                if (track_bet == 'tiers') {
                                    coefficient = 2;
                                    devider = 6
                                } else if (track_bet == 'jeu') {
                                    devider = 4;
                                } else {
                                    devider = 9;
                                }
                                if(count * chip_value % 5 != 0) {
                                    let x = 2;
                                    do {
                                        x++;
                                    } while (((x * devider + count) * chip_value) % 5 != 0);
                                    if(count > devider) {
                                        let y = 1;
                                        while(y < count / devider && ((count - y * devider) * chip_value) % 5 != 0) {
                                            y++;
                                        }
                                        if(y < count / devider && ((count - y * devider) * chip_value) % 5 == 0) {
                                            if(y <= x || current + chip_value * (count + x * devider) > number_maximum * coefficient * (count + x * devider)) {
                                                x = -y;
                                            }
                                        }
                                    }
                                    potential_count = count + x * devider;
                                }

                                if(current + chip_value * potential_count > number_maximum * coefficient * potential_count) {
                                    possible = false;
                                    showInfo(`Ставки на треке должны быть кратны 5. Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум в номер: ${number_maximum}`);
                                    break;
                                } else {
                                    track[track_bet] = potential_count;
                                }
                            }
                            amount += chip_value * track[track_bet];
                        }
                    }

                    if(possible) {
                        if(amount + total_amount > balance) {
                            showInfo(`Невозможно сделать ставки с текущим балансом и выбранной фишкой`);
                        } else if(amount + total_amount > table_maximum) {
                            showInfo(`Невозможно сделать ставки с выбранной фишкой, так как будет превышен максимум стола: ${table_maximum}`);
                        } else {
                            for(let [number, count] of Object.entries(numbers)) {
                                bet(number, undefined, count);
                            }
                            for(let [sector, count] of Object.entries(sectors)) {
                                bet(sector, undefined, count);
                            }
                            for(let [border, border_data] of Object.entries(borders)) {
                                bet(border, border_data['name'], border_data['count']);
                            }
                            for(let [track_bet, count] of Object.entries(track)) {
                                bet(track_bet, undefined, count);
                            }
                        }
                    }
                    preset_lock = false;
                },
                error: (data) => {
                }
            });
        }
    })

    $(document).on('click', '.stream_info', () => {
        if($('.stream_info_content').css('display') == 'flex') {
            $('.stream_info').css('width', $('.stream_info').css('width'));
            $('.stream_info').css('overflow', 'hidden');
            $('.stream_info_content').css('white-space', 'nowrap');
            $('.stream_info').animate({
                'width': '35px'
            }, 500, () => {
                $('.stream_info_content').css({'display': 'none', 'white-space': ''});
                $('.stream_info').css({'overflow': '', 'width': ''});
            })
        } else {
            $('.stream_info').css({'overflow': 'hidden', 'width': '35px'});
            $('.stream_info_content').css({'display': '', 'white-space': 'nowrap'});
            $('.stream_info').animate({
                'width': parseInt($('.stream_info_content').css('width').replace('px', '')) + 35
            }, 500, () => {
                $('.stream_info').css({'overflow': '', 'width': ''});
                $('.stream_info_content').css('white-space', '');
            })
        }
    })

    $(document).on('click', '.stream_open_table', () => {
        $('.stream_bottom_block').animate({
            'bottom': '0'
        }, 1000, () => {
            $('.stream_bottom_arrow > img').css('display', 'flex');
        });
    })

    function closeTable() {
        $('.stream_bottom_block').animate({
            'bottom': `-${$('.stream_bottom_block').css('height')}`
        }, 1000, () => {
            $('.stream_bottom_arrow > img').css('display', '');
        });
    }

    $(document).on('click', '.stream_bottom_arrow', () => {
        closeTable();
    })

    $(document).on('click', '.stream_close_table', () => {
        closeTable();
    })

    $(document).on('click', '.stream_rotate', () => {
        if($('.track').css('flex-direction') == 'row') {
            $('.track').css('flex-direction', 'row-reverse');
            $('.track_center').css('flex-direction', 'column-reverse');
            $('.track_top_line').css('flex-direction', 'row-reverse');
            $('.track_bottom_line').css('flex-direction', 'row-reverse');
            $('.track_left').css({'flex-direction': 'column-reverse', 'border-radius': 0, 'border-top-right-radius': '1000px', 'border-bottom-right-radius': '1000px', 'border-left-width': '1px', 'border-right-width': '2px'});
            $('.track_right').css({'border-radius': 0, 'border-top-left-radius': '1000px', 'border-bottom-left-radius': '1000px', 'border-left-width': '2px', 'border-right-width': '1px'});
            $('#track_5').css({'justify-content': 'start', 'padding-left': $('#track_0').css('padding-left'), 'align-items': 'flex-end', 'padding-bottom': $('#track_0').css('padding-bottom')});
            $('#track_10').css({'justify-content': 'end', 'padding-right': $('#track_26').css('padding-right'), 'align-items': 'flex-start', 'padding-top': $('#track_23').css('padding-top')});
            $('#track_23').css({'justify-content': 'end', 'padding-right': $('#track_26').css('padding-right'), 'align-items': 'flex-end', 'padding-bottom': $('#track_10').css('padding-bottom')});
            $('#track_8').css({'justify-content': 'start', 'padding-left': $('#track_3').css('padding-left'), 'align-items': 'flex-start', 'padding-top': $('#track_3').css('padding-top')});
            $('#track_3').css({'justify-content': 'end', 'padding-right': $('#track_8').css('padding-right'), 'align-items': 'flex-end', 'padding-bottom': $('#track_8').css('padding-bottom')});
            $('#track_26').css({'justify-content': 'start', 'padding-left': $('#track_10').css('padding-left')});
            $('#track_0').css({'justify-content': 'end', 'padding-right': $('#track_5').css('padding-right'), 'align-items': 'flex-start', 'padding-top': $('#track_5').css('padding-top')});
            $('.track_5_block').css({'clip-path': 'polygon(0 0%, 100% 60%, 100% 100%, 0 100%)', 'top': 'auto', 'bottom': '0'});
            $('.track_8_block').css({'clip-path': 'polygon(0 0, 100% 0%, 100% 40%, 0 100%)', 'top': '0', 'bottom': 'auto'});
            $('.track_3_block').css({'clip-path': 'polygon(0 60%, 100% 0%, 100% 100%, 0 100%)', 'top': 'auto', 'bottom': '0'});
            $('.track_0_block').css({'clip-path': 'polygon(0 0, 100% 0%, 100% 100%, 0 40%)', 'top': '0', 'bottom': 'auto'});
            $('.line_5_10').css({'clip-path': 'polygon(0 calc(100% - 2px), calc(100% - 2px) 40%, 100% calc(40% + 2px), 0 100%)'});
            $('.line_23_8').css({'clip-path': 'polygon(2px 0, 100% 60%, calc(100% - 2px) calc(60% + 2px), 0 2px)'});
            $('.line_3_26').css({'clip-path': 'polygon(2px 40%, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 calc(40% + 2px))'});
            $('.line_26_0').css({'clip-path': 'polygon(0 60%, calc(100% - 2px) 0, 100% 2px, 2px calc(60% + 2px))'});
            $('.jeu_block').css({'right': 'auto', 'left': '10%'});
            $('.voisins_block').css({'right': '52.35%', 'left': 'auto'});
            $('.orphelins_block').css({'right': '29%', 'left': 'auto', 'clip-path': 'polygon(0 0, 60% 0, 100% 100%, 0 100%)'});
            $('.tiers_block').css({'right': '10%', 'left': 'auto', 'border-radius': '0', 'border-top-right-radius': '1000px', 'border-bottom-right-radius': '1000px', 'clip-path': 'polygon(0 0, 100% 0%, 100% 100%, 33% 100%)'});
            $('#orphelins').css({'justify-content': 'start', 'padding-left': $('#orphelins').css('padding-right')});
            $('#tiers').css({'border-radius': '0', 'border-top-right-radius': '1000px', 'border-bottom-right-radius': '1000px'});
            $('.line_tiers_orphelins').css({'right': '29%', 'left': 'auto'});
            $('.track_left > .track_num > .stream_field_chip').css({'left': 'auto', 'right': '8%', 'bottom': '3%', 'top': 'auto'});
            $('#track_10 > .stream_field_chip').css({'bottom': 'auto', 'top': '3%'})
            $('#track_26 > .stream_field_chip').css({'right': 'auto', 'left': '8%'});
            $('#track_5 > .stream_field_chip').css({'right': 'auto', 'left': '15%', 'bottom': '8%', 'top': 'auto'});
            $('#track_8 > .stream_field_chip').css({'right': 'auto', 'left': '15%', 'bottom': 'auto', 'top': '8%'});
            $('#track_3 > .stream_field_chip').css({'left': 'auto', 'right': '15%', 'bottom': '8%', 'top': 'auto'});
            $('#track_0 > .stream_field_chip').css({'left': 'auto', 'right': '15%', 'bottom': 'auto', 'top': '9%'});
            $('#tiers > .stream_field_chip').css({'left': 'auto', 'right': '40.59%'});
            $('#orphelins > .stream_field_chip').css({'left': 'auto', 'right': '53%'});
            $('#voisins > .stream_field_chip').css({'left': 'auto', 'right': '38.58%'});
            $('#jeu > .stream_field_chip').css({'left': 'auto', 'right': '40%'});
        } else {
            $('.track').css('flex-direction', '');
            $('.track_center').css('flex-direction', '');
            $('.track_top_line').css('flex-direction', '');
            $('.track_bottom_line').css('flex-direction', '');
            $('.track_left').css({'flex-direction': '', 'border-radius': '', 'border-top-right-radius': '', 'border-bottom-right-radius': '', 'border-left-width': '', 'border-right-width': ''});
            $('.track_right').css({'border-radius': '', 'border-top-left-radius': '', 'border-bottom-left-radius': '', 'border-left-width': '', 'border-right-width': ''});
            $('#track_5').css({'justify-content': '', 'padding-right': '', 'padding-left': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_10').css({'justify-content': '', 'padding-left': '', 'padding-right': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_23').css({'justify-content': '', 'padding-left': '', 'padding-right': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_8').css({'justify-content': '', 'padding-right': '', 'padding-left': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_3').css({'justify-content': '', 'padding-left': '', 'padding-right': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_26').css({'justify-content': '', 'padding-right': '', 'padding-left': ''});
            $('#track_0').css({'justify-content': '', 'padding-left': '', 'padding-right': '', 'align-items': '', 'padding-top': '', 'padding-bottom': ''});
            $('.track_5_block').css({'clip-path': '', 'top': '', 'bottom': ''});
            $('.track_8_block').css({'clip-path': '', 'top': '', 'bottom': ''});
            $('.track_3_block').css({'clip-path': '', 'top': '', 'bottom': ''});
            $('.track_0_block').css({'clip-path': '', 'top': '', 'bottom': ''});
            $('.line_5_10').css({'clip-path': ''});
            $('.line_23_8').css({'clip-path': ''});
            $('.line_3_26').css({'clip-path': ''});
            $('.line_26_0').css({'clip-path': ''});
            $('.jeu_block').css({'right': '', 'left': ''});
            $('.voisins_block').css({'right': '', 'left': ''});
            $('.orphelins_block').css({'right': '', 'left': '', 'clip-path': ''});
            $('.tiers_block').css({'right': '', 'left': '', 'clip-path': '', 'border-radius': '', 'border-top-right-radius': '', 'border-bottom-right-radius': ''});
            $('#orphelins').css({'justify-content': '', 'padding-left': ''});
            $('#tiers').css({'border-radius': '', 'border-top-right-radius': '', 'border-bottom-right-radius': ''});
            $('.line_tiers_orphelins').css({'right': '', 'left': ''});
            $('.track_num > .stream_field_chip').css({'right': '', 'left': '', 'bottom': '', 'top': ''});
            $('.track_sector > .stream_field_chip').css({'right': '', 'left': ''});
        }
    })

    $(document).on('click', '.stream_bets_arrow', () => {
        if($('.stream_bets_arrow > img').css('display') == 'none') {
            $('.stream_bets_block').animate({
                'right': '0'
            }, 1000, () => {
                $('.stream_bets_arrow > img').css('display', 'flex');
                $('.stream_bets_arrow > span').css('display', 'none');
            });
            $('.stream_bets_arrow').animate({
                'width': '20px'
            }, 1000);
        } else {
            $('.stream_bets_block').animate({
                'right': `-${$('.stream_bets_content').width()}`
            }, 1000, () => {
                $('.stream_bets_arrow > img').css('display', '');
                $('.stream_bets_arrow > span').css('display', '');
            });
            $('.stream_bets_arrow').animate({
                'width': '40px'
            }, 1000);
        }
    })

    $(document).on('click', '.stream_chat_arrow', () => {
        if($('.stream_chat_arrow > img').css('display') == 'none') {
            $('.stream_chat_block').animate({
                'left': '0'
            }, 1000, () => {
                $('.stream_chat_arrow > img').css('display', 'flex');
                $('.stream_chat_arrow > span').css('display', 'none');
            });
            $('.stream_chat_arrow').animate({
                'width': '20px'
            }, 1000);
        } else {
            $('.stream_chat_block').animate({
                'left': `-${$('.stream_chat_content').width()}`
            }, 1000, () => {
                $('.stream_chat_arrow > img').css('display', '');
                $('.stream_chat_arrow > span').css('display', '');
            });
            $('.stream_chat_arrow').animate({
                'width': '40px'
            }, 1000);
        }
    })

    $(document).on('click', '.stream_bets_petal', (e) => {
        if(!e.target.classList.contains('stream_petal_close')) {
            $('.stream_petal_close').click();
            $('.stream_bets_block').animate({
                'right': '0'
            }, 1000);
            $('.stream_bets_petal').animate({
                'right': $('.stream_bets_content').width(),
                'width': '35'
            }, 1000);
            $('.stream_bets_petal .closed').animate({
                'opacity': '0'
            }, 500, () => {
                $('.stream_bets_petal .closed').css('display', 'none');
                $('.stream_bets_petal .open').css('display', 'inline');
                $('.stream_bets_petal .open').animate({
                    'opacity': '1'
                }, 500, () => {
                    e.target.classList.add('stream_petal_close');
                })
            })
        } else {
            $('.stream_bets_block').animate({
                'right': `-${$('.stream_bets_content').width()}`
            }, 1000);
            $('.stream_bets_petal').animate({
                'right': '0',
                'width': '80'
            }, 1000);
            $('.stream_bets_petal .open').animate({
                'opacity': '0'
            }, 500, () => {
                $('.stream_bets_petal .open').css('display', '');
                $('.stream_bets_petal .closed').css('display', '');
                $('.stream_bets_petal .closed').animate({
                    'opacity': '1'
                }, 500, () => {
                    e.target.classList.remove('stream_petal_close');
                })
            })
        }
    })

    $(document).on('click', '.stream_chat_petal', (e) => {
        if(!e.target.classList.contains('stream_petal_close')) {
            $('.stream_petal_close').click();
            $('.stream_chat_block').animate({
                'right': '0'
            }, 1000);
            $('.stream_chat_petal').animate({
                'right': $('.stream_chat_content').width(),
                'width': '35'
            }, 1000);
            $('.stream_chat_petal .closed').animate({
                'opacity': '0'
            }, 500, () => {
                $('.stream_chat_petal .closed').css('display', 'none');
                $('.stream_chat_petal .open').css('display', 'inline');
                $('.stream_chat_petal .open').animate({
                    'opacity': '1'
                }, 500, () => {
                    e.target.classList.add('stream_petal_close');
                })
            })
        } else {
            $('.stream_chat_block').animate({
                'right': `-${$('.stream_chat_content').width()}`
            }, 1000);
            $('.stream_chat_petal').animate({
                'right': '0',
                'width': '80'
            }, 1000);
            $('.stream_chat_petal .open').animate({
                'opacity': '0'
            }, 500, () => {
                $('.stream_chat_petal .open').css('display', '');
                $('.stream_chat_petal .closed').css('display', '');
                $('.stream_chat_petal .closed').animate({
                    'opacity': '1'
                }, 500, () => {
                    e.target.classList.remove('stream_petal_close');
                })
            })
        }
    })

    $(document).on('click', '.stream_swap', () => {
        if($('.stream_roulette_block').css('display') == 'none') {
            $('.stream_roulette_block').css('display', '');
            $('.stream_track_block').css('display', '');
        } else {
            $('.stream_roulette_block').css('display', 'none');
            $('.stream_track_block').css('display', 'flex');
        }
    })

    $('.stream_logout').on('click', () => {
        $('.stream_background').css('display', 'flex');
        $('.stream_background > div').css('display', 'none');
        $('.stream_logout_confirmation_block').css('display', 'flex');
    })

    $('.stream_logout_cancel').on('click', () => {
        $('.stream_background').click();
    })

    $('.stream_participate').on('click', () => {
        $('.stream_background').css('display', 'flex');
        $('.stream_background > div').css('display', 'none');
        $.ajax({
            method: "get",
            url: "/user_page/system_balance_info/",
            data: {admin_id: admin_id},
            success: (data) => {
                let balance = data['balance'];
                let cost = data['cost'];
                $('.stream_participate_balance').html(balance);
                $('.stream_participate_cost').html(cost);
                if(balance >= cost) {
                    $('.stream_participate_confirmation_block').css('display', 'inline-block');
                } else {
                    $('.stream_participate_not_enough').css('display', 'inline-block');
                }
            },
            error: (data) => {
            }
        });
    })

    $('.stream_participate_confirm').on('click', () => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/participate/",
            data: {admin_id: admin_id, csrfmiddlewaretoken: token},
            success: (data) => {
                $('.stream_background').click();
                $('.stream_participate').css('display', '');
                if(data['result'] == 'ok') {
                    changeBalance(parseInt(data['balance']), data['add_fakes']);
                    $('.stream_fake').attr('src', `/${$('#static_url').val()}img/tournament.png`);
                    $('.stream_fake').css('display', 'flex');
                    $('.stream_system_balance').html(data['system_balance']);
                    showInfo('Теперь вы играете в турнире');
                }
            },
            error: (data) => {
            }
        });
    })

    $('.stream_undo_spin').on('click', () => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/undo_spin/",
            data: {admin_id: admin_id, csrfmiddlewaretoken: token},
            success: (data) => {
            },
            error: (data) => {
            }
        });
    })

    $('.stream_confidential_checkbox').on('change', (e) => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/change_confidential/",
            data: {value: e.target.checked, csrfmiddlewaretoken: token},
            success: (data) => {
                showInfo('Конфиденциальность ваших ставок успешно изменена')
            },
            error: (data) => {
            }
        });
    })

    $('.stream_deposit_confidential_checkbox').on('change', (e) => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/change_deposit_confidential/",
            data: {value: e.target.checked, csrfmiddlewaretoken: token},
            success: (data) => {
                showInfo('Конфиденциальность вашего депозита при игре на реальные деньги успешно изменена')
            },
            error: (data) => {
            }
        });
    })

    $('.stream_hide_table_checkbox').on('change', (e) => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/change_hide_table/",
            data: {value: e.target.checked, csrfmiddlewaretoken: token},
            success: (data) => {
                showInfo('Настройки были успешно сохранены')
            },
            error: (data) => {
            }
        });
    })

    $('.stream_auto_spin_checkbox').on('change', (e) => {
        const token = $('input[name=csrfmiddlewaretoken]').val();
        $.ajax({
            method: "post",
            url: "/user_page/change_auto_spin/",
            data: {value: e.target.checked, csrfmiddlewaretoken: token},
            success: (data) => {
                showInfo('Настройки были успешно сохранены')
            },
            error: (data) => {
            }
        });
    })

    $('.stream_open_table').click();

    window.addEventListener('resize', () => {

        if($('.stream_bets_arrow > img').css('display') == 'none') {
            $('.stream_bets_block').css('right', '');
            $('.stream_bets_arrow').css('width', '');
        } else {
            $('.stream_bets_block').css('right', '0');
            $('.stream_bets_arrow').css('width', '20px');
        }

        if($('.stream_chat_arrow > img').css('display') == 'none') {
            $('.stream_chat_block').css('left', '');
            $('.stream_chat_arrow').css('width', '');
        } else {
            $('.stream_chat_block').css('left', '0');
            $('.stream_chat_arrow').css('width', '20px');
        }

        if($('.stream_bottom_content').css('flex-direction') != 'row-reverse') {
            $('.stream_roulette_block').css('display', '');
            $('.stream_track_block').css('display', '');
            
            if($('.stream_bets_block').css('right') != '0px') {
                $('.stream_bets_arrow').css('width', '40px');
            }
            if($('.stream_chat_block').css('left') != '0px') {
                $('.stream_chat_arrow').css('width', '40px');
            }
        } else {
            $('.stream_bets_arrow').css('width', '');
            $('.stream_chat_arrow').css('width', '');
        }

        if($('.track').css('flex-direction') == 'row-reverse') {
            $('.track_left > .track_num').css({'padding-right': '', 'padding-left': '', 'padding-top': '', 'padding-bottom': ''});
            $('.track_right > .track_num').css({'padding-right': '', 'padding-left': '', 'padding-top': '', 'padding-bottom': ''});
            $('.track_num_block > .track_num').css({'padding-right': '', 'padding-left': '', 'padding-top': '', 'padding-bottom': ''});
            $('#track_5').css({'padding-left': $('#track_0').css('padding-left'), 'padding-bottom': $('#track_0').css('padding-bottom')});
            $('#track_10').css({'padding-right': $('#track_26').css('padding-right'), 'padding-top': $('#track_23').css('padding-top')});
            $('#track_23').css({'padding-right': $('#track_26').css('padding-right'), 'padding-bottom': $('#track_10').css('padding-bottom')});
            $('#track_8').css({'padding-left': $('#track_3').css('padding-left'), 'padding-top': $('#track_3').css('padding-top')});
            $('#track_3').css({'padding-right': $('#track_8').css('padding-right'), 'padding-bottom': $('#track_8').css('padding-bottom')});
            $('#track_26').css({'padding-left': $('#track_10').css('padding-left')});
            $('#track_0').css({'padding-right': $('#track_5').css('padding-right'), 'padding-top': $('#track_5').css('padding-top')});
        }
    })

    $('#youtube_stream_link').after(`<iframe
		title="YouTube video player" frameborder="0"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
		allowfullscreen class="stream_video"></iframe>`);
    $('.stream_video').attr('src', $('#youtube_stream_link').val());
    $('#chat-link').after(`<iframe referrerpolicy="origin" src="${$('#chat-link').val() + window.location.hostname}" width="calc(100% - 4px)" height="100%" id="chat"></iframe>`);
})