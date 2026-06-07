(function () {
    const STORAGE_KEY = "lacquerGameSave";
    const GAME_ORDER = ["game1", "game2", "game3"];

    const DEFAULT_SAVE = {
        stamina: 180,
        maxStamina: 180,
        gameCost: 20,
        games: {
            game1: { unlocked: true, completed: false, bestStars: 0, stageStars: [0, 0, 0] },
            game2: { unlocked: false, completed: false, bestStars: 0, stageStars: [0, 0, 0] },
            game3: { unlocked: false, completed: false, bestStars: 0, stageStars: [0, 0, 0] }
        },
        updatedAt: null
    };

    function cloneDefault() {
        return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }

    function normalize(raw) {
        const save = Object.assign(cloneDefault(), raw || {});
        save.stamina = Number.isFinite(save.stamina) ? save.stamina : DEFAULT_SAVE.stamina;
        save.maxStamina = Number.isFinite(save.maxStamina) ? save.maxStamina : DEFAULT_SAVE.maxStamina;
        save.gameCost = Number.isFinite(save.gameCost) ? save.gameCost : DEFAULT_SAVE.gameCost;
        save.games = Object.assign({}, DEFAULT_SAVE.games, save.games || {});

        GAME_ORDER.forEach((gameId) => {
            save.games[gameId] = Object.assign({}, DEFAULT_SAVE.games[gameId], save.games[gameId] || {});
            const game = save.games[gameId];
            if (!Array.isArray(game.stageStars)) {
                game.stageStars = [Number(game.bestStars) || 0, 0, 0];
            }
            game.stageStars = [0, 1, 2].map((index) => {
                return Math.max(0, Math.min(3, Number(game.stageStars[index]) || 0));
            });
            game.bestStars = game.stageStars.reduce((sum, stars) => sum + stars, 0);
            save.games[gameId].completed = Boolean(save.games[gameId].completed);
            save.games[gameId].unlocked = Boolean(save.games[gameId].unlocked);
        });

        save.games.game1.unlocked = true;
        return save;
    }

    function read() {
        try {
            return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
        } catch (error) {
            return cloneDefault();
        }
    }

    function write(save) {
        const next = normalize(save);
        next.stamina = Math.max(0, Math.min(next.maxStamina, next.stamina));
        next.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("lacquer-save-change", { detail: next }));
        return next;
    }

    function getSummary(save) {
        const data = normalize(save || read());
        const totalStars = GAME_ORDER.reduce((sum, gameId) => sum + data.games[gameId].bestStars, 0);
        const completedCount = GAME_ORDER.filter((gameId) => data.games[gameId].completed).length;
        return {
            totalStars,
            maxStars: GAME_ORDER.length * 9,
            completedCount,
            totalGames: GAME_ORDER.length
        };
    }

    function consumeStamina(cost) {
        const save = read();
        const amount = Number.isFinite(cost) ? cost : save.gameCost;
        if (save.stamina < amount) return { ok: false, save };
        save.stamina -= amount;
        return { ok: true, save: write(save) };
    }

    function addStamina(amount) {
        const save = read();
        save.stamina += Math.max(0, Number(amount) || 0);
        return write(save);
    }

    function rewardForStars(stars) {
        if (stars >= 3) return 20;
        if (stars === 2) return 10;
        if (stars === 1) return 5;
        return 0;
    }

    function recordGameResult(gameId, stars, stageIndex) {
        const save = read();
        const safeStars = Math.max(0, Math.min(3, Number(stars) || 0));
        const safeStageIndex = Math.max(0, Math.min(2, Number(stageIndex) || 0));
        const game = save.games[gameId];
        if (!game) return { save, reward: 0, improved: false };

        const previousBest = game.stageStars[safeStageIndex];
        const improved = safeStars > previousBest;
        let reward = 0;
        if (improved) {
            reward = rewardForStars(safeStars) - rewardForStars(previousBest);
            game.stageStars[safeStageIndex] = safeStars;
            game.bestStars = game.stageStars.reduce((sum, value) => sum + value, 0);
            if (reward > 0) save.stamina += reward;
        }

        if (game.stageStars.some((value) => value > 0)) {
            game.completed = true;
            const nextGame = GAME_ORDER[GAME_ORDER.indexOf(gameId) + 1];
            if (nextGame) save.games[nextGame].unlocked = true;
        }

        return { save: write(save), reward, improved };
    }

    function reset() {
        return write(cloneDefault());
    }

    window.LacquerSave = {
        gameOrder: GAME_ORDER.slice(),
        get: read,
        set: write,
        reset,
        getSummary,
        consumeStamina,
        addStamina,
        recordGameResult,
        rewardForStars
    };
})();
