import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { db } from './db.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { createImagesSequentially } from './shopImageCreator.js';

dotenv.config();
const bot = new TelegramBot(process.env.TOKEN_BOT, { polling: false });
const app = express();
app.use(express.json());

app.post(`/bot${process.env.TOKEN_BOT}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});

bot.setWebHook(`https://${process.env.DOMAIN}/bot${process.env.TOKEN_BOT}`);

const userStates = {};

bot.setMyCommands([
  { command: '/start', description: 'Main menu' },
  { command: '/info', description: "FAQ" }
]);



const getInlineKeyboard = (isAdmin, userLanguage) => {
    const textAddChannel = userLanguage === 'ru' ? 'Добавить канал' : 'Add Channel';
    const textAddChat = userLanguage === 'ru' ? 'Добавить в чат' : 'Add to Chat';
    const userChannels = userLanguage === 'ru' ? 'Настройка канала' : 'Channel settings';
    const showShop = userLanguage === 'ru' ? 'Посмотреть ежедневный магазин' : 'View the Daily Shop';
    const textViewUsers = userLanguage === 'ru' ? 'Просмотреть всех пользователей' : 'View All Users';
  
    const keyboard = [
      [{ text: textAddChannel, callback_data: 'add_channel' }, { text: textAddChat, url: 'https://t.me/fortniteposter_bot?startgroup' }],
      [{ text: userChannels, callback_data: 'user_channel' }],
      [{ text: showShop, callback_data: 'show_default_shop' }],
    ];
  
    if (isAdmin) {
      keyboard.push([{ text: textViewUsers, callback_data: 'view_users' }]);
      keyboard.push([{ text: 'for test ' + textAddChannel, url: 'https://t.me/fortniteposter_bot?startchannel=true&admin=change_info+post_messages' }]);
    }
    return { reply_markup: { inline_keyboard: keyboard } };
  };
  
  const getChannelSettingsKeyboard = (userLanguage, channelId) => {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: userLanguage === 'ru' ? 'Установить язык' : 'Set Language', callback_data: `choose_language_${channelId}` }, { text: userLanguage === 'ru' ? 'Установить описание' : 'Set Description', callback_data: `set_description_${channelId}` }],
          [{ text: userLanguage === 'ru' ? 'Посмотреть шоп' : 'Show shop', callback_data: `show_shop_${channelId}` }],
          [{ text: userLanguage === 'ru' ? 'Удалить канал' : 'Delete Channel', callback_data: `delete_channel_${channelId}` }],
          [{ text: userLanguage === 'ru' ? '⬅️Назад' : '⬅️Back', callback_data: 'back_to_channels' }]
        ]
      }
    };
  };
  
  const getUserChannelsKeyboard = (userLanguage, channels) => {
    const keyboard = [];
    for (let i = 0; i < channels.length; i += 2) {
      const row = [];
      row.push({
        text: channels[i].channel_name || channels[i].channel_id,
        callback_data: `channel_${channels[i].channel_id}`
      });
      if (i + 1 < channels.length) {
        row.push({
          text: channels[i + 1].channel_name || channels[i + 1].channel_id,
          callback_data: `channel_${channels[i + 1].channel_id}`
        });
      }
      keyboard.push(row);
    }
    keyboard.push([{ text: userLanguage === 'ru' ? '⬅️Назад' : '⬅️Back', callback_data: 'back_to_main' }]);
    return {
      reply_markup: { inline_keyboard: keyboard }
    };
  };
  
  const getLanguageSelectionKeyboard = (userLanguage, channelId) => {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Русский', callback_data: `set_language_ru_${channelId}` }, { text: 'English', callback_data: `set_language_en_${channelId}` }],
          [{ text: userLanguage === 'ru' ? '⬅️Назад' : '⬅️Back', callback_data: `channel_${channelId}` }]
        ]
      }
    };
  };
  
  bot.on('polling_error', (error) => {
    console.error(`[polling_error] ${error.code}: ${error.message}`);
  });
  
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userLanguage = user.language_code === 'ru' ? 'ru' : 'en';
    const caption = userLanguage === 'ru' ? `Главное меню: \n` : `Main menu: \n`;
  
    db.query(
      'SELECT * FROM users WHERE telegram_id = ?',
      [user.id],
      (err, results) => {
        if (err) {
          console.error('Error querying the database:', err);
          return;
        }
  
        if (results.length === 0) {
          db.query(
            'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES (?, ?, ?, ?)',
            [user.id, user.first_name, user.last_name, user.username],
            () => {
              const isAdmin = false;
              bot.sendMessage(chatId, caption, {
                ...getInlineKeyboard(isAdmin, userLanguage)
              });
            }
          );
        } else {
          const isAdmin = results[0].is_admin === 1;
          bot.sendMessage(chatId, caption, {
            ...getInlineKeyboard(isAdmin, userLanguage)
          });
        }
      }
    );
  });
  
  bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userLanguage = user.language_code === 'ru' ? 'ru' : 'en';
    const infoMessageRu = 'Подключение бота FortnitePoster Bot:\n\n 1) Добавьте бота на Ваш канал, назначив его администратором или в чат через ссылку в боте (Добавить в чат)\n 2) После добавления на канал, укажите в боте его юзернейм или ID (в виде -1000000000000 или @yourNameBot) \n 3) В настройках укажите предпочитаемый язык поста (по-умолчанию русский), а также описание\n \n\nМагазин обновляется ежедневно в 3:00⏰ МСК';
    const infoMessageEn = 'Connecting FortnitePoster Bot:\n\n 1) Add the bot to your channel by assigning it as an admin or in chat via a link in the bot\n 2)If you have added a channel provide your channel in the bot (in the format -1000000000000 or @yourNameBot)\n 3) In the settings select your preferred post language (default is Russian) and a caption\n\nThe shop updates daily at 3:00 AM⏰ MSK';
    const infoMessage = userLanguage === 'ru' ? infoMessageRu : infoMessageEn;
    bot.sendMessage(chatId, infoMessage);
  });
  
  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const user = query.from;
    const userLanguage = user.language_code === 'ru' ? 'ru' : 'en';
    console.log(`User ${user.id} has language_code: ${user.language_code}`);

    if (data === 'show_default_shop') {
        const imagePath = userLanguage === 'ru' ? './images/shop-ru.jpg' : './images/shop-en.jpg';
        sendTelegramPhoto(chatId, imagePath, userLanguage, '');
    }
  
    if (data === 'add_channel') {
      db.query(
        'SELECT * FROM users WHERE telegram_id = ?',
        [user.id],
        (err, results) => {
          if (err) {
            console.error('Error querying the database:', err);
            return;
          }
          if (results.length === 0) {
            bot.sendMessage(chatId, 'Please start the bot first using /start');
          } else {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Укажите Ваш канал:' : 'Enter your channel:');
            userStates[chatId] = {
              telegramId: user.id,
              state: 'awaiting_channel_id',
              previousMenu: 'main_menu'
            };
          }
        }
      );
    } 
    else if (data.startsWith('delete_channel_')) {
      const channelId = data.split('_')[2];
      db.query(
        'DELETE FROM user_channels WHERE channel_id = ?',
        [channelId],
        (err) => {
          if (err) {
            console.error('Error deleting channel:', err);
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при удалении канала.' : 'Error deleting channel.');
          } else {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Канал успешно удален.' : 'Channel successfully deleted.');
            db.query(
              'SELECT * FROM user_channels WHERE telegram_id = ?',
              [user.id],
              (err, results) => {
                if (err) {
                  console.error('Error querying the database:', err);
                  return;
                }
                bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ваши каналы:' : 'Your channels:', getUserChannelsKeyboard(userLanguage, results));
                userStates[chatId] = { previousMenu: 'main_menu' };
              }
            );
          }
        }
      );
    } else if (data === 'user_channel') {
      db.query(
        'SELECT * FROM user_channels WHERE telegram_id = ?',
        [user.id],
        (err, results) => {
          if (err) {
            console.error('Error querying the database:', err);
            return;
          }
          if (results.length === 0) {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'У вас нет добавленных каналов.' : 'You have no added channels.');
          } else {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ваши каналы:' : 'Your channels:', getUserChannelsKeyboard(userLanguage, results));
            userStates[chatId] = { previousMenu: 'main_menu' };
          }
        }
      );
    } else if (data.startsWith('channel_')) {
      const channelId = data.split('_')[1];
      bot.sendMessage(chatId, userLanguage === 'ru' ? 'Выберите действие для канала:' : 'Select action for the channel:', getChannelSettingsKeyboard(userLanguage, channelId));
      userStates[chatId] = { previousMenu: 'user_channel', channelId };
    } else if (data.startsWith('choose_language_')) {
      const channelId = data.split('_')[2];
      bot.sendMessage(chatId, userLanguage === 'ru' ? 'Выберите язык:' : 'Choose a language:', getLanguageSelectionKeyboard(userLanguage, channelId));
    } else if (data.startsWith('set_language_')) {
      const language = data.split('_')[2];
      const channelId = data.split('_')[3];
      db.query(
        'UPDATE user_channels SET language = ? WHERE channel_id = ?',
        [language, channelId],
        (err) => {
          if (err) {
            console.error('Error updating language:', err);
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при обновлении языка.' : 'Error updating language.');
          } else {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Язык обновлен: ' + (language === 'ru' ? 'Русский' : 'English') : 'Language updated: ' + (language === 'ru' ? 'Russian' : 'English'));
          }
          bot.sendMessage(chatId, userLanguage === 'ru' ? 'Выберите действие для канала:' : 'Select action for the channel:', getChannelSettingsKeyboard(userLanguage, channelId));
        }
      );
    } else if (data.startsWith('set_description_')) {
      const channelId = data.split('_')[2];
      bot.sendMessage(chatId, userLanguage === 'ru' ? 'Введите описание:' : 'Enter description:');
      userStates[chatId] = {
        telegramId: user.id,
        state: 'awaiting_description',
        channelId,
        previousMenu: `channel_${channelId}`
      };
    }
    else if (data.startsWith('show_shop_')) {
      const channelId = data.split('_')[2];
      db.query(
        'SELECT language, description FROM user_channels WHERE channel_id = ?',
        [channelId],
        (err, results) => {
          if (err) {
            console.error('Error retrieving parameters:', err);
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при получении параметров.' : 'Error retrieving parameters.');
          } else {
            if (results.length > 0) {
              const { language, description } = results[0];
              const imagePath = language === 'ru' ? './images/shop-ru.jpg' : './images/shop-en.jpg';
              sendTelegramPhoto(chatId, imagePath, language, description);
            } else {
              bot.sendMessage(chatId, userLanguage === 'ru' ? 'Параметры не найдены.' : 'Parameters not found.');
            }
          }
        }
      );
    } else if (data === 'back_to_channels') {
      db.query(
        'SELECT * FROM user_channels WHERE telegram_id = ?',
        [user.id],
        (err, results) => {
          if (err) {
            console.error('Error querying the database:', err);
            return;
          }
          bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ваши каналы:' : 'Your channels:', getUserChannelsKeyboard(userLanguage, results));
          userStates[chatId] = { previousMenu: 'main_menu' };
        }
      );
    } else if (data === 'view_users') {
      getAllUsersWithChannels((err, results) => {
        if (err) {
          bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при получении данных.' : 'Error retrieving data.');
        } else {
          let message = userLanguage === 'ru' ? 'Все пользователи с их каналами:\n' : 'All users with their channels:\n';
          message += `Всего:  ${results.length}\n`;
  
          results.forEach(row => {
            if (row.username) {
              message += `\n👤 @${row.username}:`;
            } else {
              message += `\n👤 ${row.first_name || ''} ${row.last_name || ''}:`;
            }
  
            if (row.channels && row.channels.length > 0) {
              row.channels.forEach(channel => {
                message += `\n   ${channel.channel_id}`;
              });
            } else {
              message += userLanguage === 'ru' ? '\n  У пользователя нет каналов.' : '\n  User has no channels.';
            }
            message += '\n';
          });
  
          bot.sendMessage(chatId, message);
        }
      });
    } else if (data === 'back_to_main') {
      bot.sendMessage(chatId, userLanguage === 'ru' ? 'Главное меню: \n' : 'Main menu: \n', {
        ...getInlineKeyboard(false, userLanguage)
      });
    }
  
    bot.answerCallbackQuery(query.id);
  });
  
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userLanguage = user.language_code === 'ru' ? 'ru' : 'en';
    const state = userStates[chatId];
  
    if (state && state.state === 'awaiting_channel_id') {
      const channelId = msg.text;
      const REGEX = /^-\d{13}$/;
      const REGEX_NAME = /^@([a-zA-Z0-9_]{5,32})$/;
    
      if (REGEX.test(channelId) || REGEX_NAME.test(channelId)) {
        db.query(
          'SELECT * FROM user_channels WHERE telegram_id = ? AND channel_id = ?',
          [state.telegramId, channelId],
          (err, results) => {
            if (err) {
              console.error('Database error:', err);
              bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка базы данных.' : 'Database error.');
              delete userStates[chatId];
              return;
            }
    
            if (results && results.length > 0) {
              bot.sendMessage(chatId, userLanguage === 'ru' ? 'Этот канал уже установлен.' : 'This channel is already set.');
              delete userStates[chatId];
            } else {
              db.query(
                'INSERT INTO user_channels (telegram_id, channel_id) VALUES (?, ?)',
                [state.telegramId, channelId],
                (insertErr) => {
                  if (insertErr) {
                    console.error('Error inserting channel:', insertErr);
                    bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при сохранении канала.' : 'Error saving channel.');
                  } else {
                    bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ваш канал сохранен: ' + channelId : 'Your channel has been saved: ' + channelId);
                  }
                  delete userStates[chatId];
                }
              );
            }
          }
        );
      } else {
        bot.sendMessage(chatId, userLanguage === 'ru' ? 'Некорректные данные: ' + channelId : 'Incorrect data: ' + channelId);
        delete userStates[chatId];
      }
    } else if (state && state.state === 'awaiting_description') {
      const description = msg.text;
      const channelId = state.channelId;
      db.query(
        'UPDATE user_channels SET description = ? WHERE channel_id = ?',
        [description, channelId],
        (err) => {
          if (err) {
            console.error('Error updating description:', err);
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Ошибка при обновлении описания.' : 'Error updating description.');
          } else {
            bot.sendMessage(chatId, userLanguage === 'ru' ? 'Описание обновлено.' : 'Description updated.');
            delete userStates[chatId];
          }
        }
      );
    }
  });
  
  bot.on('new_chat_members', async (msg) => {
    const chatTitle = msg.chat.title;
    const user = msg.from.id;
    const channelId = msg.chat.id;
    db.query(
      'INSERT INTO user_channels (telegram_id, channel_id, channel_name) VALUES (?, ?, ?)',
      [user, channelId, chatTitle],
      (err) => {
        if (err) {
          console.error('Error inserting channel:', err);
        }
      }
    );
  });
  
  bot.on('left_chat_member', async (msg) => {
    const leftUserId = msg.left_chat_member.id;
    const chatId = msg.chat.id.toString();
    if (leftUserId === 6855808705) {
      db.query(
        'DELETE FROM user_channels WHERE channel_id = ?',
        [chatId],
        (err, result) => {
          if (err) {
            console.error('Error deleting bot from database:', err);
          } 
        }
      );
    }
  });
  
  
  const getAllUsersWithChannels = (callback) => {
    db.query(
      `SELECT u.username, u.first_name, u.last_name, GROUP_CONCAT(c.channel_id SEPARATOR ',') AS channel_ids, GROUP_CONCAT(c.channel_name SEPARATOR ',') AS channel_names
       FROM users u
       LEFT JOIN user_channels c ON u.telegram_id = c.telegram_id
       GROUP BY u.telegram_id`,
      (err, results) => {
        if (err) {
          console.error('Error querying the database:', err);
          callback(err, null);
        } else {
          const usersWithChannels = results.map(row => {
            const channels = [];
            if (row.channel_ids) {
              const channelIds = row.channel_ids.split(',');
              let channelNames = row.channel_names ? row.channel_names.split(',') : [];
              
              if (channelNames.length < channelIds.length) {
                channelNames = new Array(channelIds.length).fill(null).map((_, index) => channelNames[index]);
              }
              
              for (let i = 0; i < channelIds.length; i++) {
                const channelName = channelNames[i] || channelIds[i];
                channels.push({
                  channel_id: channelIds[i],
                  channel_name: channelName
                });
              }
            }
            return {
              username: row.username,
              first_name: row.first_name,
              last_name: row.last_name,
              channels: channels
            };
          });
  
          callback(null, usersWithChannels);
        }
      }
    );
  };
  
  async function sendTelegramPhoto(channelId, imagePath, language, userCaption) {
    let date = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
  
    const currentDate = date.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', options);
    const caption = language === 'ru'
      ? `✅ Магазин предметов обновлён!\n📆 ${currentDate}\n\n${userCaption ? userCaption : ' '}`
      : `✅ The item shop has been updated!\n📆 ${currentDate}\n\n${userCaption ? userCaption : ' '}`;
  
    try {
      await bot.sendPhoto(channelId, imagePath, { caption });
    } catch (error) {
      console.error("Ошибка при отправке фото в Telegram:", error.message);
    }
  }
  
  export async function sendPhotosToAllUsers() {
    await createImagesSequentially();
    db.query(
      'SELECT channel_id, language, description FROM user_channels',
      (err, results) => {
        if (err) {
          console.error('Error retrieving channels:', err);
          return;
        }
        results.forEach(({ channel_id, language, description }) => {
          const imagePath = language === 'ru' ? './images/shop-ru.jpg' : './images/shop-en.jpg';
          description ? description : ' ';
          sendTelegramPhoto(channel_id, imagePath, language, description);
        });
      }
    );
  };
  
  cron.schedule('10 3 * * *', async () => {
    try {
      await sendPhotosToAllUsers();
    } catch (error) {
      console.error('Ошибка в выполнении главной функции:', error);
    }
  }, {
    timezone: 'Europe/Kyiv'
  });
  

