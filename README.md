# AS-Banking

A modern, feature-rich banking system for QBCore-based FiveM servers. This script manages all player, job, gang, and shared accounts, with a beautiful UI and robust security.

## Features
- Player, job, gang, and shared bank accounts
- ATM and bank card integration (with PIN support)
- Shared accounts between multiple players
- Auto-creation of job/gang accounts on first use
- Boss-only access to job/gang accounts
- Internal and external transfers
- Transaction statements and history
- Daily withdrawal limits (configurable)
- Multi-language support (EN, DE, ES, IT, NL)
- Modern, responsive UI (Vue.js)

## Installation
1. **Dependencies:**
   - [qb-core](https://github.com/qbcore-framework/qb-core)
   - [oxmysql](https://github.com/overextended/oxmysql)
   - [PolyZone](https://github.com/mkafrin/PolyZone)

2. **Add to your resources folder:**
   Place the `as-banking` folder in your server's `resources` directory.

3. **Database:**
   Import `banking.sql` into your database to create the required tables.

4. **Add to your server.cfg:**
   ```
   ensure as-banking
   ```

## Configuration
Edit `config.lua` to customize ATM models, daily limits, max accounts, and bank locations. Example:
```lua
Config = {
    useTarget = true, -- Use qb-target for interaction
    atmModels = { 'prop_atm_01', 'prop_atm_02', 'prop_atm_03', 'prop_fleeca_atm' },
    useDailyLimit = true,
    dailyLimit = 5000,
    maxAccounts = 2,
    blipInfo = { name = 'Bank', sprite = 108, color = 2, scale = 0.55 },
    locations = { vector3(149.05, -1041.3, 29.37), ... }
}
```

## Usage
- **Banks:** Walk up to a bank location and press [E] or use target to open the banking UI.
- **ATMs:** Approach an ATM, use your bank card, and enter your PIN.
- **Accounts:** Create, rename, or delete shared accounts. Add/remove users (shared accounts only).
- **Transfers:** Move money between your accounts or send to other players.
- **Statements:** View transaction history for all accounts.

## UI & Localization
- The UI is built with Vue.js and is fully responsive.
- To add or edit translations, update files in `locales/`.

## Support & Contributing
- For help, visit the [My Discord](https://discord.gg/d4B8BzXf5Z)
- Contributions are welcome! See `.github/contributing.md` for guidelines.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---
**Credits:**
- QBCore Framework For Original Banking Script
