const bankingApp = Vue.createApp({
    data() {
        return {
            isBankOpen: false,
            isATMOpen: false,
            showPinPrompt: false,
            notification: null,
            activeView: "home",
            accounts: [],
            statements: {},
            selectedAccountStatement: "checking",
            playerName: "",
            accountNumber: "",
            playerCash: 0,
            selectedMoneyAccount: null,
            selectedMoneyAmount: 0,
            moneyReason: "",
            transferType: "internal",
            internalFromAccount: null,
            internalToAccount: null,
            internalTransferAmount: 0,
            externalAccountNumber: "",
            externalFromAccount: null,
            externalTransferAmount: 0,
            transferReason: "",
            debitPin: "",
            enteredPin: "",
            acceptablePins: [],
            tempBankData: null,
            createAccountName: "",
            createAccountAmount: 0,
            editAccount: null,
            editAccountName: "",
            manageAccountName: null,
            manageUserName: "",
            filteredUsers: [],
            showUsersDropdown: false,
        };
    },
    computed: {
        accountStatements() {
            if (this.selectedAccountStatement && this.statements[this.selectedAccountStatement]) {
                return this.statements[this.selectedAccountStatement];
            }
            return [];
        },
        limitedTransactions() {
            if (this.selectedAccountStatement && this.statements[this.selectedAccountStatement]) {
                return this.statements[this.selectedAccountStatement].slice(0, 3);
            }
            return [];
        },
        transactionCount() {
            if (this.selectedAccountStatement && this.statements[this.selectedAccountStatement]) {
                return this.statements[this.selectedAccountStatement].length;
            }
            return 0;
        },
        weeklySummary() {
            // Get all statements for the selected account
            const statements = this.statements[this.selectedAccountStatement] || [];
            // Get start of today and 6 days ago
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                days.push(d);
            }
            // For each day, sum income and expenses
            const daily = days.map((day, idx) => {
                const start = new Date(day);
                const end = new Date(day);
                end.setDate(day.getDate() + 1);
                let income = 0, expense = 0;
                statements.forEach(s => {
                    const date = new Date(s.date > 1e12 ? s.date : s.date * 1000);
                    if (date >= start && date < end) {
                        if (s.type === 'deposit') income += Number(s.amount);
                        else if (s.type === 'withdraw' || s.type === 'transfer') expense += Number(s.amount);
                    }
                });
                return { income, expense };
            });
            // Weekly totals
            const totalIncome = daily.reduce((sum, d) => sum + d.income, 0);
            const totalExpense = daily.reduce((sum, d) => sum + d.expense, 0);
            return { daily, totalIncome, totalExpense };
        },
        weeklyChartBars() {
            // Returns array of {type, height} for chart bars (income/expense)
            const max = Math.max(
                ...this.weeklySummary.daily.map(d => Math.max(d.income, d.expense)),
                1 // avoid division by zero
            );
            // For each day, show income and expense bars
            return this.weeklySummary.daily.map(d => [
                { type: 'income', height: (d.income / max) * 80 },
                { type: 'expense', height: (d.expense / max) * 80 }
            ]).flat();
        },
    },
    watch: {
        "manageAccountName.users": function () {
            this.filterUsers();
        },
    },
    methods: {
        openBank(bankData) {
            const playerData = bankData.playerData;
            this.playerName = playerData.charinfo.firstname;
            this.accountNumber = playerData.citizenid;
            this.playerCash = playerData.money.cash;
            this.accounts = [];
            bankData.accounts.forEach((account) => {
                this.accounts.push({
                    name: account.account_name,
                    type: account.account_type,
                    balance: account.account_balance,
                    users: account.users,
                    id: account.id,
                });
            });
            this.statements = {};
            Object.keys(bankData.statements).forEach((accountKey) => {
                this.statements[accountKey] = bankData.statements[accountKey].map((statement) => ({
                    id: statement.id,
                    date: statement.date,
                    reason: statement.reason,
                    amount: statement.amount,
                    type: statement.statement_type,
                    user: statement.citizenid,
                }));
            });
            this.isBankOpen = true;
        },
        openATM(bankData) {
            this.enteredPin = ""; // Clear the pin every time ATM is opened
            this.acceptablePins = [];
            const playerData = bankData.playerData;
            this.playerName = playerData.charinfo.firstname;
            this.accountNumber = playerData.citizenid;
            this.playerCash = playerData.money.cash;
            this.accounts = [];
            bankData.accounts.forEach((account) => {
                this.accounts.push({
                    name: account.account_name,
                    type: account.account_type,
                    balance: account.account_balance,
                    users: account.users,
                    id: account.id,
                });
            });
            this.isATMOpen = true;
        },
        pinPrompt(enteredPin) {
            const bankData = this.tempBankData;
            this.acceptablePins = Array.from(bankData.pinNumbers);
            if (this.acceptablePins.includes(parseInt(enteredPin))) {
                this.showPinPrompt = false;
                this.openATM(bankData);
            } else {
                this.enteredPin = "";
                this.addNotification("Incorrect PIN. Please try again.", "error");
            }
        },
        withdrawMoney() {
            if (!this.selectedMoneyAccount || this.selectedMoneyAmount <= 0) {
                return;
            }
            axios
                .post("https://as-banking/withdraw", {
                    accountName: this.selectedMoneyAccount.name,
                    amount: this.selectedMoneyAmount,
                    reason: this.moneyReason,
                })
                .then((response) => {
                    if (response.data.success) {
                        const account = this.accounts.find((acc) => acc.name === this.selectedMoneyAccount.name);
                        if (account) {
                            account.balance -= this.selectedMoneyAmount;
                            this.playerCash += this.selectedMoneyAmount;
                            const reason = this.moneyReason && this.moneyReason.trim() !== '' ? this.moneyReason : 'Bank Withdrawal';
                            this.addStatement(this.accountNumber, this.selectedMoneyAccount.name, reason, this.selectedMoneyAmount, "withdraw");
                            this.selectedMoneyAmount = 0;
                            this.moneyReason = "";
                            this.selectedMoneyAccount = null;
                        }
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        depositMoney() {
            if (!this.selectedMoneyAccount || this.selectedMoneyAmount <= 0) {
                return;
            }
            axios
                .post("https://as-banking/deposit", {
                    accountName: this.selectedMoneyAccount.name,
                    amount: this.selectedMoneyAmount,
                    reason: this.moneyReason,
                })
                .then((response) => {
                    if (response.data.success) {
                        const account = this.accounts.find((acc) => acc.name === this.selectedMoneyAccount.name);
                        if (account) {
                            account.balance += this.selectedMoneyAmount;
                            this.playerCash -= this.selectedMoneyAmount;
                            const reason = this.moneyReason && this.moneyReason.trim() !== '' ? this.moneyReason : 'Bank Deposit';
                            this.addStatement(this.accountNumber, this.selectedMoneyAccount.name, reason, this.selectedMoneyAmount, "deposit");
                            this.selectedMoneyAmount = 0;
                            this.moneyReason = "";
                            this.selectedMoneyAccount = null;
                        }
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        internalTransfer() {
            if (!this.internalFromAccount || !this.internalToAccount || this.internalTransferAmount <= 0) {
                return;
            }
            axios
                .post("https://as-banking/internalTransfer", {
                    fromAccountName: this.internalFromAccount.name,
                    toAccountName: this.internalToAccount.name,
                    amount: this.internalTransferAmount,
                    reason: this.transferReason,
                })
                .then((response) => {
                    if (response.data.success) {
                        const fromAccount = this.accounts.find((acc) => acc.name === this.internalFromAccount.name);
                        if (fromAccount) {
                            fromAccount.balance -= this.internalTransferAmount;
                        }
                        const toAccount = this.accounts.find((acc) => acc.name === this.internalToAccount.name);
                        if (toAccount) {
                            toAccount.balance += this.internalTransferAmount;
                        }
                        const reason = this.transferReason && this.transferReason.trim() !== '' ? this.transferReason : 'Internal transfer';
                        this.addStatement(this.accountNumber, this.internalFromAccount.name, reason, this.internalTransferAmount, "withdraw");
                        this.addStatement(this.accountNumber, this.internalToAccount.name, reason, this.internalTransferAmount, "deposit");
                        this.internalTransferAmount = 0;
                        this.transferReason = "";
                        this.internalFromAccount = null;
                        this.internalToAccount = null;
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        externalTransfer() {
            if (!this.externalFromAccount || !this.externalAccountNumber || this.externalTransferAmount <= 0) {
                return;
            }
            axios
                .post("https://as-banking/externalTransfer", {
                    fromAccountName: this.externalFromAccount.name,
                    toAccountNumber: this.externalAccountNumber,
                    amount: this.externalTransferAmount,
                    reason: this.transferReason,
                })
                .then((response) => {
                    if (response.data.success) {
                        const fromAccount = this.accounts.find((acc) => acc.name === this.externalFromAccount.name);
                        if (fromAccount) {
                            fromAccount.balance -= this.externalTransferAmount;
                        }
                        const reason = this.transferReason && this.transferReason.trim() !== '' ? this.transferReason : 'External transfer';
                        this.addStatement(this.accountNumber, this.externalFromAccount.name, reason, this.externalTransferAmount, "withdraw");
                        this.externalTransferAmount = 0;
                        this.transferReason = "";
                        this.externalFromAccount = null;
                        this.externalAccountNumber = "";
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        orderDebitCard() {
            if (!this.debitPin) {
                return;
            }

            axios
                .post("https://as-banking/orderCard", {
                    pin: this.debitPin,
                })
                .then((response) => {
                    if (response.data.success) {
                        this.debitPin = "";
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        openAccount() {
            if (!this.createAccountName || this.createAccountAmount < 0) {
                return;
            }

            axios
                .post("https://as-banking/openAccount", {
                    accountName: this.createAccountName,
                    amount: this.createAccountAmount,
                })
                .then((response) => {
                    if (response.data.success) {
                        const checkingAccount = this.accounts.find((acc) => acc.name === "checking");
                        checkingAccount.balance -= this.createAccountAmount;
                        this.accounts.push({
                            name: this.createAccountName,
                            type: "shared",
                            balance: this.createAccountAmount,
                            users: JSON.stringify([this.playerName]),
                        });
                        this.addStatement(this.accountNumber, "checking", "Initial deposit for " + this.createAccountName, this.createAccountAmount, "withdraw");
                        this.addStatement(this.accountNumber, this.createAccountName, "Initial deposit", this.createAccountAmount, "deposit");
                        this.createAccountName = "";
                        this.createAccountAmount = 0;
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.createAccountName = "";
                        this.createAccountAmount = 0;
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        renameAccount() {
            if (!this.editAccount || !this.editAccountName) {
                return;
            }

            axios
                .post("https://as-banking/renameAccount", {
                    oldName: this.editAccount.name,
                    newName: this.editAccountName,
                })
                .then((response) => {
                    if (response.data.success) {
                        const account = this.accounts.find((acc) => acc.name === this.editAccount.name);
                        if (account) {
                            account.name = this.editAccountName;
                        }
                        this.editAccount = null;
                        this.editAccountName = "";
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        deleteAccount() {
            if (!this.editAccount) {
                return;
            }

            axios
                .post("https://as-banking/deleteAccount", {
                    accountName: this.editAccount.name,
                })
                .then((response) => {
                    if (response.data.success) {
                        this.accounts = this.accounts.filter((acc) => acc.name !== this.editAccount.name);
                        this.editAccount = null;
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        addUserToAccount() {
            if (!this.manageAccountName || !this.manageUserName) {
                return;
            }
            axios
                .post("https://as-banking/addUser", {
                    accountName: this.manageAccountName.name,
                    userName: this.manageUserName,
                })
                .then((response) => {
                    if (response.data.success) {
                        let usersArray = JSON.parse(this.manageAccountName.users);
                        usersArray.push(this.manageUserName);
                        this.manageAccountName.users = JSON.stringify(usersArray);
                        this.manageUserName = "";
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        removeUserFromAccount() {
            if (!this.manageAccountName || !this.manageUserName) {
                return;
            }

            axios
                .post("https://as-banking/removeUser", {
                    accountName: this.manageAccountName.name,
                    userName: this.manageUserName,
                })
                .then((response) => {
                    if (response.data.success) {
                        let usersArray = JSON.parse(this.manageAccountName.users);
                        usersArray = usersArray.filter((user) => user !== this.manageUserName);
                        this.manageAccountName.users = JSON.stringify(usersArray);
                        this.manageUserName = "";
                        this.addNotification(response.data.message, "success");
                    } else {
                        this.addNotification(response.data.message, "error");
                    }
                });
        },
        addStatement(accountNumber, accountName, reason, amount, type) {
            if (!accountName) return;
            let newStatement = {
                date: Date.now(),
                user: accountNumber,
                reason: reason,
                amount: amount,
                type: type,
            };
            if (!this.statements[accountName]) {
                this.$set ? this.$set(this.statements, accountName, []) : this.statements[accountName] = [];
            }
            this.statements[accountName].unshift(newStatement); // Add to the start for latest first
        },
        addNotification(message, type) {
            this.notification = {
                message: message,
                type: type,
            };

            setTimeout(() => {
                this.notification = null;
            }, 3000);
        },
        appendNumber(number) {
            this.enteredPin += number.toString();
        },
        selectAccount(account) {
            this.selectedAccountStatement = account.name;
        },
        setTransferType(type) {
            this.transferType = type;
        },
        setActiveView(view) {
            this.activeView = view;
        },
        formatCurrency(amount) {
            return Number(amount).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        },
        filterUsers() {
            if (!this.manageAccountName || typeof this.manageAccountName.users !== "string") {
                this.filteredUsers = [];
                return;
            }
            let usersArray;
            try {
                usersArray = JSON.parse(this.manageAccountName.users);
            } catch (e) {
                this.filteredUsers = [];
                return;
            }
            if (this.manageUserName === "") {
                this.filteredUsers = usersArray;
            } else {
                this.filteredUsers = usersArray.filter((user) => user.toLowerCase().includes(this.manageUserName.toLowerCase()));
            }
        },
        selectUser(user) {
            this.manageUserName = user;
            this.showUsersDropdown = false;
        },
        hideDropdown() {
            setTimeout(() => {
                this.showUsersDropdown = false;
            }, 100);
        },
        formatDate(timestamp) {
            if (!timestamp) return "Unknown date";
            // If timestamp is in seconds, convert to ms. If already ms, leave as is.
            let date;
            if (timestamp > 1e12) {
                // Already in ms
                date = new Date(timestamp);
            } else {
                // In seconds
                date = new Date(timestamp * 1000);
            }
            const now = new Date();
            const diffMs = now - date;
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffSeconds < 60) {
                return `${diffSeconds} seconds ago`;
            } else if (diffMinutes < 60) {
                return `${diffMinutes} minutes ago`;
            } else if (diffHours < 24) {
                return `${diffHours} hours ago`;
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else {
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        },
        balanceClass(type) {
            return type === "withdraw" || type === "transfer" ? "negative" : "positive";
        },
        handleMessage(event) {
            const action = event.data.action;
            if (action === "openBank") {
                this.openBank(event.data);
            } else if (action === "openATM") {
                this.tempBankData = event.data;
                this.showPinPrompt = true;
            }
        },
        handleKeydown(event) {
            if (event.key === "Escape") {
                this.closeApplication();
            }
        },
        closeApplication() {
            if (this.isBankOpen) {
                this.isBankOpen = false;
            } else if (this.isATMOpen) {
                this.isATMOpen = false;
            } else if (this.showPinPrompt) {
                this.showPinPrompt = false;
                this.enteredPin = "";
                this.acceptablePins = [];
                this.tempBankData = null;
            }
            axios.post(`https://${GetParentResourceName()}/closeApp`, {});
        },
        getTotalBalance() {
            return this.accounts.reduce((total, account) => {
                return total + parseFloat(account.balance);
            }, 0);
        },
    },
    mounted() {
        document.addEventListener("keydown", this.handleKeydown);
        window.addEventListener("message", this.handleMessage);
    },
    beforeUnmount() {
        document.removeEventListener("keydown", this.handleKeydown);
    },
}).mount("#app");
