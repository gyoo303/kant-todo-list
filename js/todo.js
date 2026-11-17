/**
 * HTML 특수문자를 이스케이프하여 사용자 입력이 마크업으로 해석되지 않도록 한다.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * 할일 데이터(저장/조회/변경)와 목록 출력을 담당한다.
 */
const todo = {
    items: [], // 할일 목록
    tpl: null,
    onRemoved: null, // 항목 삭제 후 호출되는 콜백 (uid) => void
    load() { // 저장된 할일 불러오기
        const tmp = localStorage.getItem("todos");
        this.items = typeof tmp === "string" ? JSON.parse(tmp) : [];
    },
    find(uid) { // 할일 한 건 조회
        return this.items.find(x => x.uid === Number(uid)) ?? null;
    },
    add(date, title, content) { // 할일 등록
        this.items.push({
            uid: Date.now(),
            date,
            title,
            content
        });

        this.save(); // 저장 처리
        this.render(); // 할일 등록 후 화면 갱신
    },
    update(uid, { date, title, content }) { // 할일 수정
        const item = this.find(uid);
        if (!item) return false;

        Object.assign(item, { date, title, content });

        this.save(); // 저장 처리
        this.render(); // 할일 수정 후 화면 갱신
        return true;
    },
    remove(uid) { // 할일 제거
        const index = this.items.findIndex(x => x.uid === Number(uid));
        if (index === -1) return;

        this.items.splice(index, 1);

        this.save(); // 저장 처리
        this.render(); // 할일 제거 후 화면 갱신

        if (typeof this.onRemoved === "function") {
            this.onRemoved(Number(uid));
        }
    },
    save() { // 할일 저장
        localStorage.setItem("todos", JSON.stringify(this.items));
    },
    getTpl() {
        if (!this.tpl) {
            this.tpl = document.getElementById("tpl").innerHTML;
        }

        return this.tpl;
    },
    renderItem(item) { // 템플릿의 ${key}를 이스케이프된 값으로 치환
        return this.getTpl().replace(/\$\{(\w+)\}/g, (_, key) => escapeHtml(item[key] ?? ""));
    },
    render() { // 할일 목록을 출력
        const targetEl = document.getElementById("todo-items");

        if (this.items.length === 0) {
            targetEl.innerHTML = "<li>할일을 등록하세요...</li>";
            return;
        }

        targetEl.innerHTML = this.items.map(item => this.renderItem(item)).join("");
    }
};

/**
 * 상단 입력 폼의 등록/수정 모드를 관리한다.
 */
const todoForm = {
    form: null,
    submitButton: null,
    cancelButton: null,
    editingUid: null, // 수정 중인 할일의 uid (등록 모드면 null)
    init(form) {
        this.form = form;
        this.submitButton = document.getElementById("submit-button");
        this.cancelButton = document.getElementById("cancel-edit-button");

        this.cancelButton.addEventListener("click", () => this.reset());
    },
    isEditing() {
        return this.editingUid !== null;
    },
    isEditingItem(uid) {
        return this.editingUid === Number(uid);
    },
    getValues() {
        return {
            date: this.form.date.value.trim(),
            title: this.form.title.value.trim(),
            content: this.form.content.value.trim()
        };
    },
    startEdit(item) { // 선택한 할일 정보를 폼에 채우고 수정 모드로 전환
        this.editingUid = item.uid;
        this.form.date.value = item.date;
        this.form.title.value = item.title;
        this.form.content.value = item.content;

        this.submitButton.textContent = "수정하기";
        this.cancelButton.classList.remove("hidden");

        this.form.scrollIntoView({ behavior: "smooth", block: "start" });
        this.form.title.focus();
    },
    reset() { // 입력값을 비우고 등록 모드로 전환
        this.editingUid = null;
        this.form.date.value = "";
        this.form.title.value = "";
        this.form.content.value = "";

        this.submitButton.textContent = "등록하기";
        this.cancelButton.classList.add("hidden");

        this.form.title.focus();
    }
};

window.addEventListener("DOMContentLoaded", function() {
    const requiredFields = {
        date: "날짜를 선택하세요.",
        title: "할일 제목을 입력하세요.",
        content: "할일 내용을 입력하세요.",
    };

    todo.load();
    todo.render(); // 최초 로딩시 이미 등록된 할일 목록을 출력

    todoForm.init(frmTodo);

    // 수정 중인 항목이 삭제되면 폼을 등록 모드로 되돌린다.
    todo.onRemoved = (uid) => {
        if (todoForm.isEditingItem(uid)) todoForm.reset();
    };

    // 삭제, 수정 버튼 클릭 처리 (이벤트 위임으로 한 번만 등록)
    document.getElementById("todo-items").addEventListener("click", function(e) {
        const deleteButton = e.target.closest(".delete-action");
        if (deleteButton) {
            if (!confirm("정말 삭제하겠습니까?")) return;
            todo.remove(deleteButton.dataset.uid);
            return;
        }

        const editButton = e.target.closest(".edit-action");
        if (editButton) {
            const item = todo.find(editButton.dataset.uid);
            if (item) todoForm.startEdit(item);
        }
    });

    frmTodo.addEventListener("submit", function(e) {
        e.preventDefault(); // 양식의 기본동작을 차단하여 양식에 제출되는 것을 막는다.

        try {
            for (const [key, msg] of Object.entries(requiredFields)) {
                if (!frmTodo[key]?.value?.trim()) {
                    throw new Error(msg);
                }
            }

            const { date, title, content } = todoForm.getValues();

            if (todoForm.isEditing()) {
                if (!todo.update(todoForm.editingUid, { date, title, content })) {
                    throw new Error("수정할 할일을 찾을 수 없습니다.");
                }
            } else {
                todo.add(date, title, content);
            }

            // 등록/수정이 완료되면 입력내용을 비우고 등록 모드로 되돌린다.
            todoForm.reset();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
});
